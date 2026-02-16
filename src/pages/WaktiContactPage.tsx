import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function WaktiContactPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the existing contact page
    navigate("/contact", { replace: true });
  }, [navigate]);

  return null;
}
