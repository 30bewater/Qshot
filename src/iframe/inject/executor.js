/**
 * executor.js — entry point for site handler execution.
 *
 * Sub-modules:
 *   executor-dom.js     — element finding, button detection, pointer events
 *   executor-actions.js — individual step executors (setValue, click, etc.)
 */

import { SUBMIT_ACTIONS, delay } from "./constants.js";
import {
  executeFocus,
  executeSetValue,
  readCurrentValue,
  executeTriggerEvents,
  executeClick,
  executeSendKeys,
  executeSmartSubmit,
} from "./executor-actions.js";
import { findElement, getSelectors } from "./executor-dom.js";
import {
  safeFocus,
  isTextControl,
  dispatchEventList,
} from "./dom-utils.js";

const FILES_MIN_SUBMIT_WAIT_MS = 20000;
const FILES_MIN_FIND_TIMEOUT_MS = 25000;
// 首次验证等待 1000ms：给输入框足够时间在提交后清空，
// 低于此值容易误判为未发送并触发错误重试（ChatGPT 等单独配了更长的 submitVerifyWaitMs）。
const SUBMIT_VERIFY_WAIT_MS = 1000;
// 多轮对话场景：上一轮 AI 仍在生成时发送按钮禁用，可能需要等待 30~60 秒才能重新启用。
// 8 次重试 × (4500ms 按钮等待 + 450ms 验证 + 2000ms 间隔) ≈ 56 秒总重试窗口，
// 加上初始 3000ms + 1000ms 共约 60 秒，覆盖绝大多数 AI 模型的生成耗时。
const SUBMIT_VERIFY_RETRY_COUNT = 8;
// 重试提交时给按钮更长的等待窗口（应对多轮对话中上一轮仍在生成的情况）
const RETRY_SUBMIT_WAIT_MS = 4500;
// 重试轮次之间的等待时长（比首次验证等待更长，给 AI 更多时间完成生成）
const RETRY_BETWEEN_WAIT_MS = 2000;

function applyFilesAwareTimeouts(step) {
  if (step.action !== "smartSubmit" && step.action !== "click") {
    return step;
  }
  const next = { ...step };
  if (next.action === "smartSubmit") {
    next.submitWaitMs = Math.max(
      Number.isFinite(next.submitWaitMs) ? next.submitWaitMs : 0,
      FILES_MIN_SUBMIT_WAIT_MS
    );
  } else if (next.action === "click") {
    next.timeout = Math.max(
      Number.isFinite(next.timeout) ? next.timeout : 0,
      FILES_MIN_FIND_TIMEOUT_MS
    );
  }
  return next;
}

export async function executeSiteHandler(query, handlerConfig, options = {}) {
  if (!handlerConfig || !Array.isArray(handlerConfig.steps) || handlerConfig.steps.length === 0) {
    throw new Error("无效的站点处理器配置");
  }

  const { hasFiles = false } = options;
  const context = { submitted: false };

  for (const rawStep of handlerConfig.steps) {
    const step = hasFiles ? applyFilesAwareTimeouts(rawStep) : rawStep;

    if (context.submitted && SUBMIT_ACTIONS.has(step.action)) {
      continue;
    }

    try {
      await executeStep(step, query, context);
    } catch (error) {
      if (step.optional) continue;
      const label = step.description || step.action || "未知步骤";
      throw new Error(`${label}失败: ${error.message}`);
    }

    if (step.waitAfter) {
      await delay(step.waitAfter);
    }
  }

  await verifySubmittedOrRetry(query, handlerConfig, context, { hasFiles });
}

async function executeStep(step, query, context) {
  switch (step.action) {
    case "focus":
      await executeFocus(step);
      return;
    case "setValue":
      await executeSetValue(step, query);
      return;
    case "triggerEvents":
      await executeTriggerEvents(step);
      return;
    case "click":
      if (await executeClick(step)) context.submitted = true;
      return;
    case "wait":
      await delay(step.duration || 0);
      return;
    case "sendKeys":
      await executeSendKeys(step);
      context.submitted = true;
      return;
    case "smartSubmit":
      if (await executeSmartSubmit(step, query)) context.submitted = true;
      return;
    default:
      throw new Error(`不支持的 action: ${step.action}`);
  }
}

async function verifySubmittedOrRetry(query, handlerConfig, context, options = {}) {
  const text = String(query || "").trim();
  if (!text) {
    return;
  }

  const steps = Array.isArray(handlerConfig.steps) ? handlerConfig.steps : [];
  const submitSteps = steps.filter((step) => SUBMIT_ACTIONS.has(step.action));
  const inputStep = findSubmitVerificationInputStep(steps);
  const rewriteStep = steps.find((step) => step.action === "setValue" && getSelectors(step).length > 0);
  if (submitSteps.length === 0 || !inputStep) {
    return;
  }

  const verifyWaitMs = Number.isFinite(handlerConfig.submitVerifyWaitMs)
    ? handlerConfig.submitVerifyWaitMs
    : SUBMIT_VERIFY_WAIT_MS;
  const maxRetries = Number.isFinite(handlerConfig.submitVerifyRetries)
    ? handlerConfig.submitVerifyRetries
    : SUBMIT_VERIFY_RETRY_COUNT;

  await delay(verifyWaitMs);

  for (let retryIndex = 0; retryIndex <= maxRetries; retryIndex += 1) {
    const current = await readCurrentValue(inputStep);
    if (!current.includes(text)) {
      return;
    }

    if (retryIndex >= maxRetries) {
      throw new Error("内容仍停留在输入框，发送按钮可能未生效");
    }

    // 文字仍在输入框：可能是按钮禁用（上轮 AI 仍在生成）或写入后未触发提交。
    // 若文字已存在且无需重写（输入框内容完整），直接跳过 setValue 重试提交；
    // 否则重写以确保内容刷新，再提交。
    const textAlreadyPresent = current.includes(text);
    if (!textAlreadyPresent || !rewriteStep) {
      if (rewriteStep) {
        await executeStep(rewriteStep, query, context);
        if (rewriteStep.waitAfter) await delay(rewriteStep.waitAfter);
        await delay(120);
      } else {
        await refireInputEvents(inputStep, text);
      }
    }

    context.submitted = false;
    for (const rawStep of submitSteps) {
      // 重试时给 smartSubmit 更长的按钮等待窗口，应对多轮对话中发送按钮暂时禁用的情况
      let step = options.hasFiles ? applyFilesAwareTimeouts(rawStep) : rawStep;
      if (step.action === "smartSubmit") {
        step = {
          ...step,
          submitWaitMs: Math.max(
            Number.isFinite(step.submitWaitMs) ? step.submitWaitMs : 0,
            RETRY_SUBMIT_WAIT_MS
          ),
        };
      }
      try {
        await executeStep(step, query, context);
      } catch (error) {
        if (step.optional) continue;
        throw error;
      }

      if (step.waitAfter) await delay(step.waitAfter);
      await delay(Math.min(verifyWaitMs, 450));
      const afterSubmitValue = await readCurrentValue(inputStep);
      if (!afterSubmitValue.includes(text)) {
        return;
      }
    }

    await delay(RETRY_BETWEEN_WAIT_MS);
  }
}

async function refireInputEvents(step, text) {
  try {
    const element = await findElement(step);
    safeFocus(element);
    if (isTextControl(element)) {
      dispatchEventList(element, ["input", "change"]);
      return;
    }
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      })
    );
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  } catch (_error) {
    // 保底事件失败不应阻断后续提交重试。
  }
}

function findSubmitVerificationInputStep(steps) {
  const inputActions = new Set(["setValue", "smartSubmit", "sendKeys", "focus"]);
  return steps.find((step) => step.action === "setValue" && getSelectors(step).length > 0)
    || steps.find((step) => inputActions.has(step.action) && getSelectors(step).length > 0)
    || null;
}
