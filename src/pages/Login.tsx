
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  console.log("REBUILD: Using temporary Login placeholder");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("REBUILD: Login placeholder - navigating to dashboard");
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Login (Rebuilding)</h1>
          <p className="text-sm text-muted-foreground">
            Auth system is being rebuilt - temporary login
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <Button type="submit" className="w-full">
            Continue to Dashboard (Temporary)
          </Button>
        </form>
      </div>
    </div>
  );
}
