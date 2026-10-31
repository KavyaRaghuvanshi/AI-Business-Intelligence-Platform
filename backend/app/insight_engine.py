def generate_evidence(df):
    findings = []

    # 1. Dataset overview
    findings.append({
        "id": "dataset_overview",
        "category": "overview",
        "severity": "info",
        "title": "Dataset Overview",
        "claim": (
            f"The dataset contains {len(df)} rows "
            f"and {len(df.columns)} columns."
        ),
        "evidence": {
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "columns": [str(column) for column in df.columns]
        },
        "recommendation": (
            "Identify the columns and metrics that are most "
            "relevant to your business objective."
        )
    })

    # 2. Missing values
    missing = df.isnull().sum()
    missing_columns = {
        str(column): int(count)
        for column, count in missing.items()
        if count > 0
    }

    findings.append({
        "id": "missing_values",
        "category": "data_quality",
        "severity": "warning" if missing_columns else "success",
        "title": "Missing Value Check",
        "claim": (
            f"Found {int(missing.sum())} missing values."
            if missing_columns
            else "No missing values were detected."
        ),
        "evidence": {
            "total_missing": int(missing.sum()),
            "affected_columns": missing_columns
        },
        "recommendation": (
            "Review affected columns and decide whether to fill "
            "or remove missing values."
            if missing_columns
            else "Continue monitoring data quality as new records arrive."
        )
    })

    # 3. Duplicate records
    duplicate_count = int(df.duplicated().sum())

    findings.append({
        "id": "duplicate_records",
        "category": "data_quality",
        "severity": "warning" if duplicate_count else "success",
        "title": "Duplicate Record Check",
        "claim": (
            f"Found {duplicate_count} completely duplicated rows."
        ),
        "evidence": {
            "duplicate_rows": duplicate_count,
            "total_rows": int(len(df))
        },
        "recommendation": (
            "Inspect duplicate records before removing them."
            if duplicate_count
            else "No completely duplicated rows require review."
        )
    })

    # 4. Numeric summaries and potential outliers
    numeric_df = df.select_dtypes(include="number")

    for column in numeric_df.columns:
        values = numeric_df[column].dropna()

        if values.empty:
            continue

        mean_value = float(values.mean())
        median_value = float(values.median())
        min_value = float(values.min())
        max_value = float(values.max())

        findings.append({
            "id": f"numeric_{column}",
            "category": "numeric_analysis",
            "severity": "info",
            "title": f"{column}: Statistical Summary",
            "claim": (
                f"Average {mean_value:.2f}, median {median_value:.2f}, "
                f"minimum {min_value:.2f}, maximum {max_value:.2f}."
            ),
            "evidence": {
                "column": str(column),
                "valid_values": int(len(values)),
                "missing_values": int(numeric_df[column].isna().sum()),
                "mean": mean_value,
                "median": median_value,
                "minimum": min_value,
                "maximum": max_value
            },
            "recommendation": (
                "Compare these values with business targets and "
                "historical results before drawing conclusions."
            )
        })

        # IQR outlier check
        if len(values) >= 4:
            q1 = float(values.quantile(0.25))
            q3 = float(values.quantile(0.75))
            iqr = q3 - q1

            if iqr > 0:
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr

                outliers = values[
                    (values < lower_bound) | (values > upper_bound)
                ]

                if len(outliers) > 0:
                    findings.append({
                        "id": f"outliers_{column}",
                        "category": "outlier_detection",
                        "severity": "warning",
                        "title": f"Potential Outliers: {column}",
                        "claim": (
                            f"Found {int(len(outliers))} values outside "
                            "the IQR-based range."
                        ),
                        "evidence": {
                            "column": str(column),
                            "outlier_count": int(len(outliers)),
                            "lower_bound": float(lower_bound),
                            "upper_bound": float(upper_bound),
                            "sample_values": [
                                float(value)
                                for value in outliers.head(10).tolist()
                            ]
                        },
                        "recommendation": (
                            "Investigate these values. They may represent "
                            "errors or legitimate unusual cases."
                        )
                    })

    return findings
