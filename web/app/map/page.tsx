import { MapApp } from "@/ui/map/MapApp";
import { requireAuthenticatedPage } from "@/infrastructure/server/pageAuth";

export default async function MapPage() {
  await requireAuthenticatedPage();

  return <MapApp />;
}
