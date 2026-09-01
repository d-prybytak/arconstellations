import { createFileRoute } from "@tanstack/react-router";
import { SkyApp } from "@/components/sky-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SkyApp />;
}
