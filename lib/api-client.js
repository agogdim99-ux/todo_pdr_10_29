// 화면 코드가 백엔드 API를 부를 때 쓰는 공통 함수. (Supabase는 여기서도 부르지 않는다)

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || `요청 실패 (${response.status})`, response.status);
  }
  return response.status === 204 ? null : response.json();
}
