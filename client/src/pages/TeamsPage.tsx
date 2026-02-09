import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateResourceDialog from '@/components/ui/create-resource-dialog';
import { fetchTeams, createTeam } from '@/api/teamApi';
import { queryKeys } from '@/constants/query-keys';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';

/**
 * 팀 목록 페이지.
 *
 * 사용자가 속한 팀 목록을 표시하고, 새 팀 생성 기능을 제공한다.
 * 팀 카드를 클릭하면 해당 팀의 프로젝트 목록으로 이동한다.
 */
export default function TeamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /** 팀 생성 다이얼로그 열림 상태 */
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.teams.all,
    queryFn: fetchTeams,
  });

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      toast.success('Team created');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to create team')),
  });

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">My Teams</h2>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No teams yet. Create your first team to get started.
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Card
                  key={team.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(ROUTES.PROJECTS(team.id))}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Owner: {team.ownerName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateResourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create New Team"
        inputLabel="Team Name"
        placeholder="Enter team name"
        onCreate={(name) => createTeamMutation.mutateAsync(name)}
      />
    </div>
  );
}
