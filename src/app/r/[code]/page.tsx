import { Suspense } from "react";
import { Room, Splash } from "@/components/Room";

export default function RoomPage({ params }: PageProps<"/r/[code]">) {
  return (
    <Suspense fallback={<Splash />}>
      {params.then(({ code }) => (
        <Room code={code.toUpperCase()} />
      ))}
    </Suspense>
  );
}
