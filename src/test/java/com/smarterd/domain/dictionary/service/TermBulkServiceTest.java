package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.service.session.InMemoryBulkValidationSessionStore;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
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
class TermBulkServiceTest {

    @Mock
    private TermRepository termRepository;

    @Mock
    private DomainRepository domainRepository;

    @Mock
    private DictionarySetService dictionarySetService;

    @Mock
    private AuthService authService;

    @Mock
    private TeamService teamService;

    @Test
    @DisplayName("generateTemplate - 용어 템플릿 엑셀을 생성한다")
    void generateTemplate_createsTermTemplateExcel() {
        // given
        final var fixture = createFixture();
        final var termBulkService = createService();

        when(authService.findUserByLoginId(fixture.loginId())).thenReturn(fixture.user());
        when(teamService.findTeamById(fixture.teamId())).thenReturn(fixture.team());
        when(dictionarySetService.findByTeamAndId(fixture.team(), fixture.setId())).thenReturn(fixture.dictionarySet());

        // when
        final var excelData = termBulkService.generateTemplate(
            fixture.loginId(),
            fixture.teamId(),
            fixture.setId(),
            Locale.KOREAN
        );
        final var dataSheet = (XSSFSheet) excelData.excelBook().getSheetAt(0);
        final var guideSheet = excelData.excelBook().getSheet("가이드");

        // then
        assertThat(excelData).isNotNull();
        assertThat(excelData.excelBook().getNumberOfSheets()).isGreaterThanOrEqualTo(2);
        assertThat(dataSheet.getSheetName()).isEqualTo("용어");
        assertThat(dataSheet.getPaneInformation()).isNotNull();
        assertThat(dataSheet.getPaneInformation().isFreezePane()).isTrue();
        assertThat(dataSheet.getRow(0).getCell(0).getCellStyle().getFillPattern()).isEqualTo(
            FillPatternType.SOLID_FOREGROUND
        );
        assertThat(guideSheet).isNotNull();
        assertThat(guideSheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("업로드 템플릿 가이드");
    }

    @Test
    @DisplayName("validateUpload/bulkSave - 도메인 참조를 검증하고 기존 용어를 갱신 저장한다")
    void validateUploadAndBulkSave_updatesExistingTermWithDomainReference() {
        // given
        final var fixture = createFixture();
        final var domain = createDomain(30L, "이름", fixture.team(), fixture.dictionarySet());
        final var existingTerm = Term.builder()
            .logicalName("사용자명")
            .physicalName("old_user_name")
            .description("old")
            .team(fixture.team())
            .dictionarySet(fixture.dictionarySet())
            .build();
        final var termBulkService = createService();
        final var csv = """
            logicalName,physicalName,domainLogicalName,description
            사용자명,user_name,이름,시스템 사용자명
            """;
        final var file = new MockMultipartFile(
            "file",
            "term-template.csv",
            "text/csv",
            csv.getBytes(StandardCharsets.UTF_8)
        );

        when(authService.findUserByLoginId(fixture.loginId())).thenReturn(fixture.user());
        when(teamService.findTeamById(fixture.teamId())).thenReturn(fixture.team());
        when(dictionarySetService.findByTeamAndId(fixture.team(), fixture.setId())).thenReturn(fixture.dictionarySet());
        when(domainRepository.findByDictionarySet(fixture.dictionarySet())).thenReturn(List.of(domain));
        when(
            termRepository.findByDictionarySetAndLogicalNameIn(fixture.dictionarySet(), List.of("사용자명"))
        ).thenReturn(List.of(existingTerm));

        // when
        final var validation = termBulkService.validateUpload(
            fixture.loginId(),
            fixture.teamId(),
            fixture.setId(),
            file,
            Locale.KOREAN
        );
        final var saveResult = termBulkService.bulkSave(
            fixture.loginId(),
            fixture.teamId(),
            fixture.setId(),
            validation.validationToken(),
            List.of()
        );

        // then
        verify(termRepository).saveAll(List.of(existingTerm));
        assertThat(validation.validationToken()).isNotBlank();
        assertThat(validation.totalCount()).isEqualTo(1);
        assertThat(validation.validCount()).isEqualTo(1);
        assertThat(validation.errorCount()).isZero();
        assertThat(saveResult.savedCount()).isEqualTo(1);
        assertThat(saveResult.failedCount()).isZero();
        assertThat(existingTerm.getPhysicalName()).isEqualTo("user_name");
        assertThat(existingTerm.getDomain()).isSameAs(domain);
        assertThat(existingTerm.getDescription()).isEqualTo("시스템 사용자명");
    }

    private TermBulkService createService() {
        final var objectMapper = new ObjectMapper().findAndRegisterModules();
        return new TermBulkService(
            termRepository,
            domainRepository,
            dictionarySetService,
            new InMemoryBulkValidationSessionStore(objectMapper),
            objectMapper,
            authService,
            teamService,
            createMessageSource()
        );
    }

    private ResourceBundleMessageSource createMessageSource() {
        final var messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        messageSource.setFallbackToSystemLocale(false);
        return messageSource;
    }

    private Fixture createFixture() {
        final var loginId = "tester";
        final var teamId = 1L;
        final var setId = 10L;
        final var user = createUser(100L, loginId);
        final var team = createTeam(teamId, user);
        return new Fixture(loginId, teamId, setId, user, team, createDictionarySet(setId, team));
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

    private Domain createDomain(Long id, String logicalName, Team team, DictionarySet dictionarySet) {
        final var domain = Domain.builder()
            .logicalName(logicalName)
            .dataType("VARCHAR")
            .dataLength(100)
            .physicalType("VARCHAR(100)")
            .team(team)
            .dictionarySet(dictionarySet)
            .build();
        ReflectionTestUtils.setField(domain, "id", id);
        return domain;
    }

    private record Fixture(
        String loginId,
        Long teamId,
        Long setId,
        User user,
        Team team,
        DictionarySet dictionarySet
    ) {}
}
