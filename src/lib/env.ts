export const getEnv = (key: string) => {
  return ((import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || '') as string;
};
