export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: "text-embedding-3-small",
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.data?.[0]?.embedding as number[];
}

export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}
