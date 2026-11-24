// 与后端交互的单一入口。所有网络请求都经过这里，便于统一处理
// CSRF、错误提示、并发冲突与会话刷新。

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function csrfToken() {
  const entry = document.cookie.split('; ').find((c) => c.startsWith('csrftoken='));
  return entry ? decodeURIComponent(entry.slice('csrftoken='.length)) : '';
}

/**
 * 发起请求。
 * payload 为 FormData 时按 multipart 发送，否则按 JSON 发送。
 */
export async function api(action, payload, { method } = {}) {
  const isForm = payload instanceof FormData;
  const verb = method ?? (payload ? 'POST' : 'GET');
  const response = await fetch(`api/${action}`, {
    method: verb,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: payload && !isForm ? { 'X-CSRFToken': csrfToken(), 'Content-Type': 'application/json' } : {},
    body: payload ? (isForm ? payload : JSON.stringify(payload)) : undefined,
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    throw new ApiError(result.error || '请求未完成，请刷新页面重新登录或重试', response.status);
  }
  return result;
}

/** 读取当前会话状态。 */
export function fetchState() {
  return api('state');
}

/** 执行一次写操作，返回后端结果。 */
export function command(action, payload) {
  return api(action, payload);
}

/** 登录。mode 为 'admin' 或 'student'。 */
export function login(credentials) {
  return api('login', credentials);
}

/** 退出登录。 */
export function logout() {
  return api('logout', {});
}

/** 上传签到照片给识别服务，返回建议为到课学号列表。 */
export function recognize(eventId, file) {
  const data = new FormData();
  data.set('event', eventId);
  data.set('photo', file);
  return api('recognize', data);
}
