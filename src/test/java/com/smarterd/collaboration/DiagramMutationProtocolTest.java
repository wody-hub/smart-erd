package com.smarterd.collaboration;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.api.common.GlobalExceptionHandler;
import com.smarterd.api.diagram.DiagramMutationController;
import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.config.websocket.CollaborationProtocolConfig;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.diagram.service.DiagramDictionaryBindingService;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramSnapshotService;
import com.smarterd.domain.diagram.websocket.room.DiagramRoomManager;
import com.smarterd.domain.user.service.AuthService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

@ExtendWith(MockitoExtension.class)
class DiagramMutationProtocolTest {

    @Mock
    private DiagramRepository content;

    @Mock
    private DiagramSnapshotService snapshot;

    @Mock
    private DiagramRoomManager room;

    @Mock
    private DiagramDictionaryBindingService bindings;

    @Mock
    private AuthService auth;

    @InjectMocks
    private DiagramService service;

    @Test
    void headerlessDictionaryPatchAtMinimumThreeNeverCallsContentSnapshotOrRoom() throws Exception {
        final var properties = new CollaborationProperties();
        properties.setMinEditProtocolVersion(3);
        final var registry = mock(InterceptorRegistry.class);
        new CollaborationProtocolConfig(new CollaborationProtocolPolicy(properties)).addInterceptors(registry);
        final var interceptor = ArgumentCaptor.forClass(HandlerInterceptor.class);
        verify(registry).addInterceptor(interceptor.capture());
        final var messages = new ResourceBundleMessageSource();
        messages.setBasename("i18n/messages");
        final var mvc = MockMvcBuilders.standaloneSetup(new DiagramMutationController(service))
            .setControllerAdvice(new GlobalExceptionHandler(messages))
            .addInterceptors(interceptor.getValue())
            .build();
        mvc
            .perform(
                patch("/api/teams/1/projects/2/diagrams/3/dictionary-set")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"dictionarySetId\":5}")
            )
            .andExpect(status().is(426));
        verifyNoInteractions(content, snapshot, room, bindings, auth);
    }
}
