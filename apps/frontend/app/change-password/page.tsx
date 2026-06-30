export default function ChangePasswordPage() {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1117] text-white">
        <div className="max-w-md w-full p-8 bg-slate-900 rounded-3xl border border-slate-800">
          <h1 className="text-xl font-semibold mb-2">Update Password</h1>
          <p className="text-slate-500 text-sm mb-6">
            For security, please set a new password for your account.
          </p>
          {/* Add your ChangePasswordForm component here */}
        </div>
      </div>
    );
  }