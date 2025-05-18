
import { Outlet } from "react-router-dom";

// Temporary placeholder during auth rebuild
// This allows navigation while we're reconstructing the auth system
export default function ProtectedRoute() {
  console.log("REBUILD: Using temporary ProtectedRoute placeholder");
  return <Outlet />;
}
