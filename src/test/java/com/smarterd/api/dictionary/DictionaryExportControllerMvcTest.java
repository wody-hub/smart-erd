package com.smarterd.api.dictionary;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.domain.dictionary.service.DomainBulkService;
import com.smarterd.domain.dictionary.service.DomainDictionaryExportService;
import com.smarterd.domain.dictionary.service.DomainService;
import com.smarterd.domain.dictionary.service.TermBulkService;
import com.smarterd.domain.dictionary.service.TermDictionaryExportService;
import com.smarterd.domain.dictionary.service.TermService;
import com.smarterd.domain.dictionary.service.WordBulkService;
import com.smarterd.domain.dictionary.service.WordDictionaryExportService;
import com.smarterd.domain.dictionary.service.WordService;
import com.smarterd.utils.excel.ExcelData;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class DictionaryExportControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private WordService wordService;

    @Mock
    private WordBulkService wordBulkService;

    @Mock
    private WordDictionaryExportService wordDictionaryExportService;

    @Mock
    private TermService termService;

    @Mock
    private TermBulkService termBulkService;

    @Mock
    private TermDictionaryExportService termDictionaryExportService;

    @Mock
    private DomainService domainService;

    @Mock
    private DomainBulkService domainBulkService;

    @Mock
    private DomainDictionaryExportService domainDictionaryExportService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        final var wordController = new WordController(wordService, wordBulkService, wordDictionaryExportService);
        final var termController = new TermController(termService, termBulkService, termDictionaryExportService);
        final var domainController = new DomainController(
            domainService,
            domainBulkService,
            domainDictionaryExportService
        );

        this.mockMvc = MockMvcBuilders.standaloneSetup(wordController, termController, domainController)
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
    }

    @Test
    void downloadWordDictionary_returnsExcelAttachment() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("단어 사전").createRow(0).createCell(0).setCellValue("단어 사전");
        when(wordDictionaryExportService.generateWordDictionary(eq("tester"), eq(1L), eq(2L))).thenReturn(
            new ExcelData(workbook, "words-export")
        );

        mockMvc
            .perform(
                get("/api/teams/1/dictionary-sets/2/words/download/excel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(
                header().string("Content-Disposition", org.hamcrest.Matchers.containsString("words-export.xlsx"))
            );

        verify(wordDictionaryExportService).generateWordDictionary(eq("tester"), eq(1L), eq(2L));
    }

    @Test
    void downloadTermDictionary_returnsExcelAttachment() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("용어 사전").createRow(0).createCell(0).setCellValue("용어 사전");
        when(termDictionaryExportService.generateTermDictionary(eq("tester"), eq(1L), eq(2L))).thenReturn(
            new ExcelData(workbook, "terms-export")
        );

        mockMvc
            .perform(
                get("/api/teams/1/dictionary-sets/2/terms/download/excel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(
                header().string("Content-Disposition", org.hamcrest.Matchers.containsString("terms-export.xlsx"))
            );

        verify(termDictionaryExportService).generateTermDictionary(eq("tester"), eq(1L), eq(2L));
    }

    @Test
    void downloadDomainDictionary_returnsExcelAttachment() throws Exception {
        final var workbook = new XSSFWorkbook();
        workbook.createSheet("도메인 사전").createRow(0).createCell(0).setCellValue("도메인 사전");
        when(domainDictionaryExportService.generateDomainDictionary(eq("tester"), eq(1L), eq(2L))).thenReturn(
            new ExcelData(workbook, "domains-export")
        );

        mockMvc
            .perform(
                get("/api/teams/1/dictionary-sets/2/domains/download/excel").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(
                header().string("Content-Disposition", org.hamcrest.Matchers.containsString("domains-export.xlsx"))
            );

        verify(domainDictionaryExportService).generateDomainDictionary(eq("tester"), eq(1L), eq(2L));
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
    }

    private static final class TestJwtArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return (
                parameter.hasParameterAnnotation(AuthenticationPrincipal.class) &&
                Jwt.class.isAssignableFrom(parameter.getParameterType())
            );
        }

        @Override
        public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
        ) {
            return webRequest
                .getNativeRequest(jakarta.servlet.http.HttpServletRequest.class)
                .getAttribute(TEST_JWT_REQUEST_ATTRIBUTE);
        }
    }
}
