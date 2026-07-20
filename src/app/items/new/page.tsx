import type { Metadata } from "next";
import { ActionItemPage } from "@/components/action-items/action-item-page";

export const metadata: Metadata = {
  title: "New Action Item · RaidGuild",
};

export default function NewActionItemPage() {
  return <ActionItemPage itemId={null} />;
}
