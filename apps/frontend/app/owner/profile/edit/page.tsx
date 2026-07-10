export const dynamic = "force-dynamic";

import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ProfileEditForm from "@/components/ProfileEditForm";

export default async function EditProfilePage() {
  const session = await getSessionUser();
  if (!session?.email) return null;

  const user = await prisma.user.findUnique({ where: { email: session.email } });
  if (!user) return null;

  return (
    <ProfileEditForm
      initialFullName={user.fullName || ""}
      initialPhone={user.phoneNumber || ""}
      initialEmail={user.email}
      initialImage={user.image}
    />
  );
}
