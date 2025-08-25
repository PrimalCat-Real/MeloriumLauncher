
import Image from "next/image";
import title from '@/assets/images/title.png'
import GameButtons from "@/components/downloads/GameButtons";
import LoginRedirect from "@/components/login/login-redirect";
import ActiveEndpointSelector from "@/components/shared/ActiveEndpointSelector";
import OnlinePlayersDisplay from "@/components/shared/OnlinePlayersDisplay";
import VersionInfoCard from "@/components/shared/AutoUpdater";
// import { Progress } from "@/components/ui/progress";
// import Image from "next/image";
// import { useRouter } from "next/router";
// import { use, useEffect } from "react";

export default function Home() {
  // const router = useRouter()
  // useEffect(() => {

  // })
  return (
    <main className="flex flex-col w-full justify-start items-center h-full relative">
      <Image className="w-2/3" src={title} alt={"title melorium"}></Image>
      <LoginRedirect></LoginRedirect>
      <div className="flex flex-col gap-6 items-center">
        <OnlinePlayersDisplay></OnlinePlayersDisplay>
        <GameButtons></GameButtons>
        <VersionInfoCard></VersionInfoCard>
      </div>
      <ActiveEndpointSelector></ActiveEndpointSelector>
        {/* <Download></Download>
        <LaunchGame></LaunchGame> */}
    </main>
  );
}
