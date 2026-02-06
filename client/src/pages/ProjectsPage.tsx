import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import axiosInstance from '@/api/axiosInstance';

interface Project {
  id: number;
  name: string;
  teamId: number;
  createdAt: string;
}

interface TeamMember {
  userId: number;
  loginId: string;
  name: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

interface Team {
  id: number;
  name: string;
  ownerName: string;
  memberCount: number;
}

/**
 * 프로젝트 목록 페이지.
 *
 * 선택된 팀의 프로젝트 목록, 프로젝트 생성, 멤버 관리 기능을 제공한다.
 */
export default function ProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Create project dialog
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Members dialog
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [inviteLoginId, setInviteLoginId] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const fetchTeam = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/teams/${teamId}`);
      setTeam(res.data);
    } catch {
      navigate('/teams');
    }
  }, [teamId, navigate]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/teams/${teamId}/projects`);
      setProjects(res.data);
    } catch {
      console.error('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/teams/${teamId}/members`);
      setMembers(res.data);
    } catch {
      console.error('Failed to fetch members');
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
    fetchProjects();
    fetchMembers();
  }, [fetchTeam, fetchProjects, fetchMembers]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);

    try {
      await axiosInstance.post(`/teams/${teamId}/projects`, { name: newProjectName.trim() });
      setNewProjectName('');
      setProjectDialogOpen(false);
      await fetchProjects();
    } catch {
      console.error('Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await axiosInstance.delete(`/teams/${teamId}/projects/${projectId}`);
      await fetchProjects();
    } catch {
      console.error('Failed to delete project');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteLoginId.trim()) return;
    setInviting(true);
    setInviteError('');

    try {
      await axiosInstance.post(`/teams/${teamId}/members`, {
        loginId: inviteLoginId.trim(),
        role: inviteRole,
      });
      setInviteLoginId('');
      await fetchMembers();
      await fetchTeam();
    } catch {
      setInviteError('Failed to invite member. Check the Login ID.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this member from the team?')) return;

    try {
      await axiosInstance.delete(`/teams/${teamId}/members/${userId}`);
      await fetchMembers();
      await fetchTeam();
    } catch {
      console.error('Failed to remove member');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-muted p-6">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/teams')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Teams
          </Button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">{team?.name ?? 'Loading...'}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {team?.memberCount} member{team?.memberCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMembersDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Members
              </Button>
              <Button onClick={() => setProjectDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No projects yet. Create your first project.
                </p>
                <Button onClick={() => setProjectDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => navigate(`/teams/${teamId}/projects/${project.id}/diagrams/new`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteProject(project.id, e)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Team Members</DialogTitle>
            <DialogDescription>Manage members of this team.</DialogDescription>
          </DialogHeader>

          {/* Invite form */}
          <form onSubmit={handleInviteMember} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="invite-id" className="text-xs">
                Login ID
              </Label>
              <Input
                id="invite-id"
                placeholder="Login ID"
                value={inviteLoginId}
                onChange={(e) => setInviteLoginId(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role" className="text-xs">
                Role
              </Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'VIEWER')}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="MEMBER">MEMBER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
            <Button type="submit" size="sm" disabled={inviting || !inviteLoginId.trim()}>
              {inviting ? '...' : 'Invite'}
            </Button>
          </form>
          {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

          {/* Member list */}
          <div className="space-y-2 mt-4 max-h-64 overflow-auto">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2 rounded-md bg-muted"
              >
                <div>
                  <p className="text-sm font-medium">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.loginId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-background border">
                    {member.role}
                  </span>
                  {member.role !== 'ADMIN' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveMember(member.userId)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
