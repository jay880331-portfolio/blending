import { TextTabBar } from "@/ui/shared/TextTabBar";

export function StoryTabs({
  active = "daily-note",
}: {
  active?: "daily-note" | "pick";
}) {
  return (
    <TextTabBar
      ariaLabel="STORY 탭"
      activeValue={active}
      items={[
        { value: "daily-note", label: "STORY", href: "/community/daily-note" },
        { value: "pick", label: "PICK", href: "/community/daily-note/pick" },
      ]}
    />
  );
}
