export type FlashParams = Record<string, string | string[] | undefined>;

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function FlashMessage({ params }: { params: FlashParams }) {
  const error = read(params.error);
  const warning = read(params.warning);
  const ok = read(params.ok);
  const message = error || warning || ok;
  if (!message) return null;
  const tone = error ? "error" : warning ? "warning" : "ok";
  return <div className={`notice ${tone}`}>{message}</div>;
}
