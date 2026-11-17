package com.smarterd.api.common;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** 문서 내용 쓰기 및 편집 ticket API의 최소 프로토콜 검사를 선언한다. */
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresEditProtocol {}
