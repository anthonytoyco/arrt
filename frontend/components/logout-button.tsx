"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    // TODO: implement logout
    router.push("/auth/login");
  };

  return <Button onClick={logout}>Logout</Button>;
}
