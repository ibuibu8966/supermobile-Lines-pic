"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  AlertCircle,
  Mail,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
} from "lucide-react";

type Step = "email" | "verify" | "password" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, birthDate, newPassword }),
      });

      if (res.ok) {
        setStep("done");
      } else {
        const data = await res.json();
        setError(data.error || "パスワードの再設定に失敗しました");
        setStep("email");
      }
    } catch {
      setError("パスワードの再設定に失敗しました");
      setStep("email");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            ログインに戻る
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>パスワード再設定</CardTitle>
            <CardDescription>
              {step === "email" && "ご登録のメールアドレスを入力してください"}
              {step === "verify" && "本人確認のため、生年月日を入力してください"}
              {step === "password" && "新しいパスワードを設定してください"}
              {step === "done" && "パスワードの再設定が完了しました"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "done" ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  <span>パスワードを再設定しました。新しいパスワードでログインしてください。</span>
                </div>
                <Button
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  ログインページへ
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Step 1: Email */}
                {step === "email" && (
                  <>
                    <div>
                      <Label htmlFor="email">メールアドレス</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="example@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!email}
                      onClick={() => {
                        setError(null);
                        setStep("verify");
                      }}
                    >
                      次へ
                    </Button>
                  </>
                )}

                {/* Step 2: Birth date */}
                {step === "verify" && (
                  <>
                    <div>
                      <Label htmlFor="birthDate">生年月日</Label>
                      <div className="relative mt-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="birthDate"
                          type="date"
                          value={birthDate}
                          onChange={(e) => setBirthDate(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep("email")}
                      >
                        戻る
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={!birthDate}
                        onClick={() => {
                          setError(null);
                          setStep("password");
                        }}
                      >
                        次へ
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: New password */}
                {step === "password" && (
                  <>
                    <div>
                      <Label htmlFor="newPassword">新しいパスワード</Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="newPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="8文字以上"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {newPassword && newPassword.length < 8 && (
                        <p className="text-sm text-red-500 mt-1">
                          パスワードは8文字以上で入力してください
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">
                        新しいパスワード（確認）
                      </Label>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirm ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowConfirm(!showConfirm)}
                        >
                          {showConfirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-red-500 mt-1">
                          パスワードが一致しません
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep("verify")}
                        disabled={isLoading}
                      >
                        戻る
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={
                          isLoading ||
                          newPassword.length < 8 ||
                          newPassword !== confirmPassword
                        }
                        onClick={handleSubmit}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            送信中...
                          </>
                        ) : (
                          "パスワードを再設定"
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {/* Step indicator */}
                <div className="flex justify-center gap-2 pt-2">
                  {["email", "verify", "password"].map((s, i) => (
                    <div
                      key={s}
                      className={`h-2 w-2 rounded-full ${
                        s === step
                          ? "bg-primary"
                          : ["email", "verify", "password"].indexOf(step) > i
                            ? "bg-primary/50"
                            : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
