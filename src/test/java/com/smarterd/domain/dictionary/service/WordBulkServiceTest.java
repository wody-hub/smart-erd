package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.service.session.InMemoryBulkValidationSessionStore;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Word;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.Locale;
import java.util.List;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WordBulkServiceTest {

    @Mock
    private WordRepository wordRepository;

    @Mock
    private DictionarySetService dictionarySetService;

    @Mock
    private AuthService authService;

    @Mock
    private TeamService teamService;

    @Test
    @DisplayName("generateTemplate - 단어 템플릿 엑셀을 생성한다")
    void generateTemplate_createsWordTemplateExcel() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var setId = 10L;
        final var user = createUser(100L, loginId);
        final var team = createTeam(teamId, user);
        final var dictionarySet = createDictionarySet(setId, team);
        final var objectMapper = new ObjectMapper().findAndRegisterModules();
        final var messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageSource.setFallbackToSystemLocale(false);

        final var wordBulkService = new WordBulkService(
            wordRepository,
            dictionarySetService,
            new InMemoryBulkValidationSessionStore(objectMapper),
            objectMapper,
            authService,
            teamService,
            messageSource
        );

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(dictionarySetService.findByTeamAndId(team, setId)).thenReturn(dictionarySet);

        // when
        final var excelData = wordBulkService.generateTemplate(loginId, teamId, setId, Locale.KOREAN);
        final var dataSheet = (XSSFSheet) excelData.excelBook().getSheetAt(0);
        final var guideSheet = excelData.excelBook().getSheet("가이드");

        // then
        assertThat(excelData).isNotNull();
        assertThat(excelData.excelBook().getNumberOfSheets()).isGreaterThanOrEqualTo(2);
        assertThat(dataSheet.getSheetName()).isEqualTo("단어");
        assertThat(dataSheet.getPaneInformation()).isNotNull();
        assertThat(dataSheet.getPaneInformation().isFreezePane()).isTrue();
        assertThat(dataSheet.getRow(0).getCell(0).getCellStyle().getFillPattern()).isEqualTo(FillPatternType.SOLID_FOREGROUND);
        assertThat(guideSheet).isNotNull();
        assertThat(guideSheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("업로드 템플릿 가이드");
    }

    @Test
    @DisplayName("validateUpload - Redis 없이도 in-memory 세션 저장소로 검증 토큰을 발급한다")
    void validateUpload_issuesValidationTokenWithoutRedis() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var setId = 10L;
        final var user = createUser(100L, loginId);
        final var team = createTeam(teamId, user);
        final var dictionarySet = createDictionarySet(setId, team);
        final var objectMapper = new ObjectMapper().findAndRegisterModules();
        final var messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageSource.setFallbackToSystemLocale(false);

        final var wordBulkService = new WordBulkService(
            wordRepository,
            dictionarySetService,
            new InMemoryBulkValidationSessionStore(objectMapper),
            objectMapper,
            authService,
            teamService,
            messageSource
        );
        final var csv = """
            logicalName,physicalName,description
            사용자,user,시스템 사용자
            """;
        final var file = new MockMultipartFile("file", "word-template.csv", "text/csv", csv.getBytes());

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(dictionarySetService.findByTeamAndId(team, setId)).thenReturn(dictionarySet);
        when(wordRepository.findByDictionarySetAndLogicalNameIn(dictionarySet, List.of("사용자"))).thenReturn(List.<Word>of());

        // when
        final var response = wordBulkService.validateUpload(loginId, teamId, setId, file, Locale.KOREAN);

        // then
        assertThat(response.validationToken()).isNotBlank();
        assertThat(response.totalCount()).isEqualTo(1);
        assertThat(response.validCount()).isEqualTo(1);
        assertThat(response.errorCount()).isZero();
        assertThat(response.rows()).hasSize(1);
        assertThat(response.rows().getFirst().valid()).isTrue();
    }

    private User createUser(Long id, String loginId) {
        final var user = User.builder().loginId(loginId).password("pw").name("Tester").build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id, User owner) {
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private DictionarySet createDictionarySet(Long id, Team team) {
        final var dictionarySet = DictionarySet.builder()
            .team(team)
            .name("Default")
            .description("desc")
            .isDefault(true)
            .build();
        ReflectionTestUtils.setField(dictionarySet, "id", id);
        return dictionarySet;
    }
}
