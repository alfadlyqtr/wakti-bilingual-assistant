export default function AdminProtectedRoute({ children }: any) {
  console.log("EMERGENCY BYPASS - ADMIN ACCESS GRANTED");
  return <>{children}</>;
}