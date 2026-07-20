import type { Metadata } from "next";
import { ActionItemPage } from "@/components/action-items/action-item-page";

export const metadata: Metadata = {
  title: "Action Item · RaidGuild",
};

export default async function ActionItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  return <ActionItemPage itemId={itemId} />;
}
