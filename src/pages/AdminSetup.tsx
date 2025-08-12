import { motion } from "framer-motion";
import AdminSetupHelper from "@/components/admin/AdminSetupHelper";

export default function AdminSetup() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Setup</h1>
          <p className="text-slate-400">
            Migrate admin authentication to Supabase Auth system
          </p>
        </div>
        
        <AdminSetupHelper />
        
        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            After setup is complete, you can access the admin dashboard using your new credentials.
          </p>
        </div>
      </motion.div>
    </div>
  );
}