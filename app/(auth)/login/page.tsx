export const dynamic = "force-dynamic";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary tracking-tight">Zafe</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Investimentos de previsão entre pessoas reais
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
