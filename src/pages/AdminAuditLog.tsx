import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  user_id: string;
  details: any;
  created_at: string;
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const { data, error } = await supabase
          .from("audit_logs")
          .select("id, action, table_name, record_id, user_id, details, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;
        setLogs(data || []);
      } catch (err) {
        console.error("[AdminAuditLog] Error loading logs:", err);
        toast.error("Failed to load audit logs");
      } finally {
        setIsLoading(false);
      }
    };

    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.table_name.toLowerCase().includes(term) ||
      log.record_id.toLowerCase().includes(term) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(term))
    );
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-foreground">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-background min-h-screen text-foreground flex flex-col">
      <AdminHeader
        title="Audit Log"
        subtitle="System-wide activity history"
        icon={<Search className="h-6 w-6 sm:h-8 sm:w-8 text-accent-purple" />}
      />

      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4 max-w-5xl mx-auto w-full">
        <Card className="enhanced-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-enhanced-heading text-base sm:text-lg">
              Recent Activity
            </CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-72">
              <Input
                placeholder="Search by action, table, id, details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-xs sm:text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSearchTerm("")}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Time</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                    <TableHead className="w-32">Table</TableHead>
                    <TableHead className="w-40">Record</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                        No audit events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="align-top text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="align-top text-xs font-medium">
                          {log.action}
                        </TableCell>
                        <TableCell className="align-top text-xs">
                          {log.table_name}
                        </TableCell>
                        <TableCell className="align-top text-xs break-all">
                          {log.record_id}
                        </TableCell>
                        <TableCell className="align-top text-xs max-w-xs">
                          <pre className="whitespace-pre-wrap break-words text-[10px] bg-muted p-2 rounded">
                            {log.details ? JSON.stringify(log.details, null, 2) : "-"}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AdminMobileNav />
    </div>
  );
}
