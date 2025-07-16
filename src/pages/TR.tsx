
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TRTaskCard } from '@/components/tr/TRTaskCard';
import { SharedTaskCard } from '@/components/tr/SharedTaskCard';
import { TRCreateTaskModal } from '@/components/tr/TRCreateTaskModal';
import { TRService, TRTask } from '@/services/trService';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { wn1NotificationService } from '@/services/wn1NotificationService';
import { toast } from 'sonner';

export default function TR() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Initialize WN1 notification service for shared task notifications
  useEffect(() => {
    if (user) {
      console.log('🔥 Initializing WN1 notification service on TR page for user:', user.id);
      wn1NotificationService.initialize(user.id).catch(error => {
        console.error('❌ Failed to initialize WN1 notification service:', error);
      });
      
      // Clear shared task badges when visiting TR page
      try {
        window.dispatchEvent(new CustomEvent('clear-badges', { 
          detail: { types: ['shared_task', 'task'] } 
        }));
      } catch (error) {
        console.warn('⚠️ Failed to clear badges:', error);
      }
    }

    return () => {
      // Cleanup notification service when leaving TR page
      wn1NotificationService.cleanup();
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userTasks = await TRService.getUserTasks(user.id);
      setTasks(userTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskCreated = () => {
    loadTasks();
    setShowCreateModal(false);
  };

  const handleTaskUpdated = () => {
    loadTasks();
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'active') return matchesSearch && !task.completed;
    if (filterStatus === 'completed') return matchesSearch && task.completed;
    
    return matchesSearch;
  });

  const activeTasks = filteredTasks.filter(task => !task.completed);
  const completedTasks = filteredTasks.filter(task => task.completed);
  const sharedTasks = filteredTasks.filter(task => task.is_shared);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading', language)}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">TR - Task & Responsibility</h1>
          <p className="text-muted-foreground">
            {t('manageTasksAndResponsibilities', language)}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('createTask', language)}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchTasks', language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            {t('all', language)}
            <Badge variant="secondary" className="ml-2">
              {tasks.length}
            </Badge>
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('active')}
          >
            {t('active', language)}
            <Badge variant="secondary" className="ml-2">
              {activeTasks.length}
            </Badge>
          </Button>
          <Button
            variant={filterStatus === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('completed')}
          >
            {t('completed', language)}
            <Badge variant="secondary" className="ml-2">
              {completedTasks.length}
            </Badge>
          </Button>
        </div>

        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Shared Tasks Section */}
      {sharedTasks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{t('sharedTasks', language)}</h2>
            <Badge variant="outline">{sharedTasks.length}</Badge>
          </div>
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {sharedTasks.map(task => (
              <SharedTaskCard
                key={task.id}
                task={task}
                assignees={[]}
                onTaskUpdated={handleTaskUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Tasks */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">{t('myTasks', language)}</h2>
          <Badge variant="outline">{filteredTasks.filter(t => !t.is_shared).length}</Badge>
        </div>
        
        {filteredTasks.filter(t => !t.is_shared).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery || filterStatus !== 'all' 
                ? t('noTasksFound', language)
                : t('noTasksYet', language)
              }
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('createFirstTask', language)}
              </Button>
            )}
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {filteredTasks.filter(t => !t.is_shared).map(task => (
              <TRTaskCard
                key={task.id}
                task={task}
                onTaskUpdated={handleTaskUpdated}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <TRCreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  );
}
