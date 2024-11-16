interface CalendarDate {
  date: Date;
  allIssues: IProjectIssues | ICycleIssues | IModuleIssues | IProjectViewIssues;
  filteredIssues: any[]; // 실제 이슈 타입으로 수정 필요
}

// 컴포넌트 내부
const getDateDetails = (date: Date, issues: IProjectIssues | ICycleIssues | IModuleIssues | IProjectViewIssues): CalendarDate => {
  return {
    date: date,
    allIssues: issues,
    filteredIssues: 'issues' in issues && Array.isArray(issues.issues) 
      ? issues.issues.filter((issue: any) => {
          const startDate = issue.start_date ? new Date(issue.start_date) : null;
          const targetDate = issue.target_date ? new Date(issue.target_date) : null;
          return (startDate && startDate <= date) || (targetDate && targetDate >= date);
        })
      : [],
  };
}; 