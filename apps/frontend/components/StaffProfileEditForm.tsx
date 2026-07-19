"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { ArrowLeft, Camera } from "lucide-react";
import { updateProfileWithPhoto } from "@/lib/profile.actions";

interface Props {
  initialFullName: string;
  initialPhone: string;
  initialEmail: string;
  initialImage: string | null;
}

export default function StaffProfileEditForm({ initialFullName, initialPhone, initialEmail, initialImage }: Props) {
  const [imagePreview, setImagePreview] = useState<string | null>(initialImage);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    setIsSubmitting(true);
    const formData = new FormData(formRef.current);

    try {
      if (selectedFile) {
        setStatus("Optimizing photo...");
        const compressed = await compressImage(selectedFile, { maxDimension: 800, quality: 0.82 });
        setStatus("Uploading photo...");
        const blob = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        });
        formData.set("imageUrl", blob.url);
      }
      formData.delete("image");

      setStatus("Saving...");
      await updateProfileWithPhoto(formData);
      setStatus("Saved!");
      setIsSubmitting(false);
      router.push("/staff/profile");
      router.refresh();
    } catch (err) {
      console.error("Profile update failed:", err);
      setStatus("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="flex items-center gap-4 p-4 border-b border-white/[0.06]">
        <a href="/staff/profile" className="p-2 -ml-2 hover:bg-white/5 rounded-full">
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-lg font-bold">Edit Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center py-4">
            <label className="relative cursor-pointer group">
              <div className="h-24 w-24 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-3xl overflow-hidden border-2 border-slate-300 dark:border-slate-700">
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  initialFullName?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="absolute bottom-0 right-0 h-8 w-8 bg-emerald-600 rounded-full flex items-center justify-center border-2 border-[var(--border-subtle)]">
                <Camera size={14} className="text-[var(--text-primary)]" />
              </div>
              <input type="file" name="image" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div className="space-y-4">
            <InputField label="Full Name" name="fullName" defaultValue={initialFullName} />
            <InputField label="Phone number" name="phone" defaultValue={initialPhone} />
            <InputField label="Email" name="email" defaultValue={initialEmail} disabled />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:cursor-not-allowed p-4 rounded-2xl font-bold mt-6 hover:bg-emerald-500 transition-colors"
          >
            {isSubmitting ? status || "Saving..." : "Save Changes"}
          </button>
        </form>
      </main>
    </div>
  );
}

function InputField({ label, name, defaultValue, disabled }: any) {
  return (
    <div>
      <label className="text-[10px] uppercase text-slate-500 font-bold ml-1">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl mt-1 text-sm focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
      />
    </div>
  );
}
