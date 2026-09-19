import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/auth";

const f = createUploadthing({
  errorFormatter: (err) => ({ message: err.message }),
});

const requireUser = f({
  image: { maxFileSize: "8MB", maxFileCount: 1 },
}).middleware(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Oturum açmanız gerekiyor.");
  }
  return { userId: session.user.id, role: session.user.role };
});

export const ourFileRouter = {
  questionImage: requireUser
    .onUploadComplete(({ file }) => ({
      url: file.url,
      key: file.key,
      name: file.name,
    })),

  replyImage: requireUser
    .onUploadComplete(({ file }) => ({
      url: file.url,
      key: file.key,
      name: file.name,
    })),

  replyAudio: f({
    audio: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.id) {
        throw new Error("Oturum açmanız gerekiyor.");
      }
      return { userId: session.user.id, role: session.user.role };
    })
    .onUploadComplete(({ file }) => ({
      url: file.url,
      key: file.key,
      name: file.name,
    })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;