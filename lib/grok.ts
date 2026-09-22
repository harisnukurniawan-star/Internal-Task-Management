import { createClient } from "@/lib/supabase/client";

export type GrokTaskAnswer = {
  answer: string;
  provider: "xai";
  model: string;
  read_only: true;
  context_counts: {
    profiles: number;
    employees: number;
    periods: number;
    tasks: number;
    claims: number;
    evaluations: number;
    leaderboard: number;
  };
};

export async function askGrokAboutTasks(question: string): Promise<GrokTaskAnswer> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) throw new Error("Pertanyaan tidak boleh kosong.");

  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke<GrokTaskAnswer>(
    "grok-task-assistant",
    { body: { question: cleanQuestion } },
  );

  if (error) throw error;
  if (!data?.answer) throw new Error("Grok tidak mengembalikan jawaban.");
  return data;
}
