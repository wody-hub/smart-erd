package com.smarterd.config.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PrettySqlFormatTest {

    private final PrettySqlFormat formatter = new PrettySqlFormat();

    @Test
    void formatMessage_formatsSelectWithLeadingCommaAndClauseLineBreak() {
        final var sql = "select u.user_no, u.user_name, coalesce(u.email, '') as email from tb_user u "
            + "left join tb_org o on o.org_no = u.org_no where u.del_yn = 'N' and u.user_name like '%jae%'";

        final var formatted = formatter.formatMessage(1, "", 12L, "statement", "", sql, "");

        assertThat(formatted).contains("SELECT u.user_no");
        assertThat(formatted).contains("\n     , u.user_name");
        assertThat(formatted).contains("\n     , coalesce(u.email, '') as email");
        assertThat(formatted).contains("\n  FROM tb_user u");
        assertThat(formatted).contains("\n  LEFT JOIN tb_org o");
        assertThat(formatted).contains("\n    ON o.org_no = u.org_no");
        assertThat(formatted).contains("\n WHERE u.del_yn = 'N'");
        assertThat(formatted).contains("\n   AND u.user_name like '%jae%'");
    }

    @Test
    void formatMessage_formatsUpdateSetWithLeadingComma() {
        final var sql = "update tb_user set user_name = 'JAE', mod_no = 100, mod_dt = now() where user_no = 10";

        final var formatted = formatter.formatMessage(1, "", 3L, "statement", "", sql, "");

        assertThat(formatted).contains("UPDATE tb_user");
        assertThat(formatted).contains("\n   SET user_name = 'JAE'");
        assertThat(formatted).contains("\n    , mod_no = 100");
        assertThat(formatted).contains("\n    , mod_dt = now()");
        assertThat(formatted).contains("\n WHERE user_no = 10");
    }

    @Test
    void formatMessage_formatsUpdateFromJoinWithPreferredClauseIndent() {
        final var sql = "update diagrams set dictionary_set_id=3 from diagrams d1_0 join projects p1_0 on p1_0.id=d1_0.project_id "
            + "where p1_0.team_id=3 and d1_0.dictionary_set_id is null and diagrams.ctid=d1_0.ctid";

        final var formatted = formatter.formatMessage(1, "", 5L, "statement", "", sql, "");

        assertThat(formatted).contains("UPDATE diagrams");
        assertThat(formatted).contains("\n   SET dictionary_set_id=3");
        assertThat(formatted).contains("\n  FROM diagrams d1_0");
        assertThat(formatted).contains("\n  JOIN projects p1_0");
        assertThat(formatted).contains("\n    ON p1_0.id=d1_0.project_id");
        assertThat(formatted).contains("\n WHERE p1_0.team_id=3");
        assertThat(formatted).contains("\n   AND d1_0.dictionary_set_id is null");
        assertThat(formatted).contains("\n   AND diagrams.ctid=d1_0.ctid");
    }

    @Test
    void formatMessage_formatsInsertColumnsAndValuesWithLeadingComma() {
        final var sql = "insert into tb_user (user_id, user_name, del_yn) values ('u1', 'User One', 'N')";

        final var formatted = formatter.formatMessage(1, "", 7L, "statement", "", sql, "");

        assertThat(formatted).contains("INSERT INTO tb_user (\n    user_id\n  , user_name\n  , del_yn\n)");
        assertThat(formatted).contains("VALUES (\n    'u1'\n  , 'User One'\n  , 'N'\n)");
    }

    @Test
    void formatMessage_returnsEmptyForBlankSql() {
        final var formatted = formatter.formatMessage(1, "", 1L, "statement", "", "   ", "");
        assertThat(formatted).isEmpty();
    }

    @Test
    void formatMessage_handlesUnicodeIdentifierWithoutIndexMismatch() {
        final var sql = "select a.\"ßcol\", a.user_name from tb_user a where a.user_no = 1 and a.del_yn = 'N'";

        final var formatted = formatter.formatMessage(1, "", 2L, "statement", "", sql, "");

        assertThat(formatted).contains("SELECT a.\"ßcol\"");
        assertThat(formatted).contains("\n     , a.user_name");
        assertThat(formatted).contains("\n  FROM tb_user a");
        assertThat(formatted).contains("\n WHERE a.user_no = 1");
        assertThat(formatted).contains("\n   AND a.del_yn = 'N'");
    }
}
