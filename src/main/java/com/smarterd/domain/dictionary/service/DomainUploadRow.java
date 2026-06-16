package com.smarterd.domain.dictionary.service;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DomainUploadRow {

    private String domainGroup;
    private String domainClassification;
    private String logicalName;
    private String dataType;
    private String dataLength;
    private String dataScale;
    private String description;
}
