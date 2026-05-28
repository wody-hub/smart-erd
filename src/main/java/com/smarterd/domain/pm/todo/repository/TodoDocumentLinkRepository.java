package com.smarterd.domain.pm.todo.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.pm.todo.entity.ProjectTodo;
import com.smarterd.domain.pm.todo.entity.TodoDocumentLink;
import com.smarterd.domain.pm.todo.entity.TodoDocumentVisibility;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * TODO-문서 연결 레포지토리.
 */
public interface TodoDocumentLinkRepository extends JpaRepository<TodoDocumentLink, Long> {
    @EntityGraph(attributePaths = { "diagram", "diagram.dictionarySet" })
    List<TodoDocumentLink> findByTodoOrderByCreatedAtDescIdDesc(ProjectTodo todo);

    Optional<TodoDocumentLink> findByTodoAndDiagram(ProjectTodo todo, Diagram diagram);

    void deleteByTodo(ProjectTodo todo);

    void deleteByTodoAndDiagram(ProjectTodo todo, Diagram diagram);

    @EntityGraph(attributePaths = { "todo", "todo.owner", "todo.linkedWbsItem", "diagram", "diagram.dictionarySet" })
    List<TodoDocumentLink> findByTodoInAndVisibility(Collection<ProjectTodo> todos, TodoDocumentVisibility visibility);
}
