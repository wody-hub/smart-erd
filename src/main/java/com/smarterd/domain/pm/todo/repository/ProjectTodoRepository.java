package com.smarterd.domain.pm.todo.repository;

import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.user.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 개인 TODO 레포지토리.
 */
public interface ProjectTodoRepository extends JpaRepository<ProjectTodo, Long> {
    @EntityGraph(attributePaths = { "owner", "linkedWbsItem" })
    List<ProjectTodo> findByProjectAndOwnerOrderByCreatedAtDescIdDesc(Project project, User owner);

    @EntityGraph(attributePaths = { "owner" })
    List<ProjectTodo> findByProjectOrderByCreatedAtDescIdDesc(Project project);

    @EntityGraph(attributePaths = { "owner", "linkedWbsItem" })
    List<ProjectTodo> findByProjectAndLinkedWbsItemIsNotNullOrderByCreatedAtDescIdDesc(Project project);

    @EntityGraph(attributePaths = { "owner", "linkedWbsItem" })
    Optional<ProjectTodo> findByProjectAndId(Project project, Long id);

    @EntityGraph(attributePaths = { "owner", "linkedWbsItem" })
    List<ProjectTodo> findByProjectAndLinkedWbsItemOrderByCreatedAtDescIdDesc(Project project, WbsItem linkedWbsItem);
}
