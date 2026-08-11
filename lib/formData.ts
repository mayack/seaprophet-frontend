// FormData.get returns `FormDataEntryValue | null`, which can be a `File`
// (e.g. if the form was tampered with). Always validate to `string` before
// using a field as text.
export function getStringField(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  return typeof v === 'string' ? v : null
}
