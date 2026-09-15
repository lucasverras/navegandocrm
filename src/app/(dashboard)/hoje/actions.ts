"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createChecklist(text: string) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };
  if (!text.trim()) return { error: "Texto obrigatório" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("checklists")
    .insert({ user_id: user.id, text: text.trim() })
    .select("id, text, lead_id, amount, due_at, type, completed_at, created_at")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/hoje");
  return { item: data };
}

export async function completeChecklist(id: string, completed: boolean) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("checklists")
    .update({ completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/hoje");
  return { ok: true };
}

export async function editChecklist(id: string, text: string) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };
  if (!text.trim()) return { error: "Texto obrigatório" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("checklists")
    .update({ text: text.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/hoje");
  return { ok: true };
}

export async function deleteChecklist(id: string) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const { error } = await admin.from("checklists").delete().eq("id", id).eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/hoje");
  return { ok: true };
}

export async function createReimbursement(description: string, amount: number) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };
  if (!description.trim() || !amount) return { error: "Descrição e valor obrigatórios" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reimbursements")
    .insert({ description: description.trim(), amount, spent_at: new Date().toISOString(), created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/hoje");
  revalidatePath("/resultados");
  return { reimbursement: data };
}

export async function markReimbursementReceived(id: string) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const { error } = await admin.from("reimbursements").update({ status: "recebido" }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/hoje");
  revalidatePath("/resultados");
  return { ok: true };
}

export async function movePipelineLead(leadId: string, stage: string, position: number) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: current } = await admin.from("leads").select("pipeline_stage").eq("id", leadId).maybeSingle();
  const stageChanged = current && (current as { pipeline_stage: string | null }).pipeline_stage !== stage;

  const update: Record<string, unknown> = {
    pipeline_stage: stage,
    pipeline_position: position,
    last_activity_at: now,
  };
  if (stageChanged) {
    update.previous_stage = (current as { pipeline_stage: string | null }).pipeline_stage;
    update.stage_changed_at = now;
  }

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return { error: error.message };

  if (stageChanged) {
    await admin.from("outreach_events").insert({
      lead_id: leadId,
      event_type: "stage_changed",
      channel: "system",
      metadata: { from: (current as { pipeline_stage: string | null }).pipeline_stage, to: stage },
      performed_by: user.id,
    });
  }

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { ok: true };
}

export async function saveLeadNote(leadId: string, notes: string) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const { error } = await admin.from("leads").update({ notes }).eq("id", leadId);
  if (error) return { error: error.message };

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function setFollowUp(leadId: string, nextFollowUpAt: string | null) {
  const user = await requireUser();
  if (!user) return { error: "Não autenticado" };

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    next_follow_up_at: nextFollowUpAt,
    last_activity_at: new Date().toISOString(),
  };
  if (nextFollowUpAt) {
    update.next_action_type = "follow_up";
    update.next_action_at = nextFollowUpAt;
  }

  const { error } = await admin.from("leads").update(update).eq("id", leadId);
  if (error) return { error: error.message };

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    event_type: "follow_up_set",
    channel: "system",
    metadata: { next_follow_up_at: nextFollowUpAt },
    performed_by: user.id,
  });

  revalidatePath("/hoje");
  revalidatePath("/pipeline");
  return { ok: true };
}
