import type { Metadata } from "next";
import CopilotApp from "@/components/CopilotApp";

export const metadata: Metadata = {
  title: "有家 Copilot",
  description: "你的料理與分享 Copilot。",
};

export default function CopilotPage() {
  return <CopilotApp />;
}
