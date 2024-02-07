export const encode = (str: string) => new TextEncoder().encode(str);
export const b = (input: TemplateStringsArray) => encode(input.join(""));
