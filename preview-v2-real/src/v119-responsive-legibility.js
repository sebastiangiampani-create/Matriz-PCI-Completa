(() => {
  if(document.getElementById('v119ResponsiveLegibility'))return;
  const style=document.createElement('style');
  style.id='v119ResponsiveLegibility';
  style.textContent=`
    /* V119 · legibilidad responsive sin alterar la estética base */
    @media (max-width: 1200px){
      .v73-card p,.v73-alert,.v73-ok{font-size:.74rem}
      .v73-status,.v73-module-toolbar span{font-size:.6rem}
      .v98d-filters label>span,.v98d-help,.v98d-area-head p,.v98d-level-head p{font-size:.62rem}
      .v98d-subject-name small,.v98d-group>header span,.v99d-plan header small{font-size:.52rem}
      .v98d-subject-name strong,.v98d-group h5,.v99d-plan header strong{font-size:.66rem}
      .v99d-plan-head{font-size:.5rem}
      .v99d-plan-row strong,.v99d-plan-row span{font-size:.58rem}
      .v95-coverage-head{font-size:.5rem}
      .v95-coverage-line>div small{font-size:.5rem}
      .v95-coverage-line>div strong,.v95-coverage-line>div span,.v95-coverage-line>b{font-size:.6rem}
    }

    @media (max-width: 900px){
      #institutional input,#institutional select,#institutional textarea,
      #v114PlanCriteriaScreen input,#v114PlanCriteriaScreen select,#v114PlanCriteriaScreen textarea,
      .v38-shell input,.v38-shell select,.v38-shell textarea,
      .v84cc-shell input,.v84cc-shell select,.v84cc-shell textarea,
      .v98d-shell input,.v98d-shell select,.v98d-shell textarea{
        min-height:42px;
        font-size:16px!important;
      }

      #institutional button,
      #v114PlanCriteriaScreen button,
      .v38-shell button,
      .v84cc-shell button,
      .v98d-shell button{
        min-height:42px;
      }

      .v71m-teacher small,.v71m-cargo-line label,.v71m-meeting,.v71m-cap,.v71m-hours span,
      .v110-coord-title>small,.v110-coord-editor summary,.v110-coord-editor-grid select,
      .v95-coord-row small,.v95-coord-row span,
      .v71o-subject-row small,.v71o-dropzone,
      .v114-card-top,.v114-meta span,.v114-plan-grid span,.v114-content-list small,
      .v114-section-head>span,.v114-criterion-title,.v114-validations strong,
      .v114-validations small,.v114-validations button,.v114-actions>span,.v114-note,
      .v114-three span,.v114-no-team{
        font-size:12px!important;
        line-height:1.35;
      }

      .v71m-teacher>strong,.v110-coord-chip strong,.v95-coord-row strong,
      .v71o-subject-row strong,.v114-plan-card h3{
        font-size:14px!important;
      }

      .v110-coord-chip small,.v110-coord-chip em{
        font-size:11px!important;
        line-height:1.3;
      }

      .v95-coord-form select,.v110-coord-editor-grid select{
        min-height:42px;
      }

      .v95-coord-row button,.v110-coord-chip button,.v71m-cargo-remove{
        min-width:36px!important;
        min-height:36px!important;
      }

      .v84cc-table-wrap,.v48-table-wrap,.v114-sheet-wrap,.v95-coverage-table{
        -webkit-overflow-scrolling:touch;
        scrollbar-gutter:stable;
      }
    }

    @media (max-width: 760px){
      .v38-field span,.v38-note,.v38-status,.v38-pick-title,.v38-own-head small,
      .v38-empty,.v94-plan-title p{
        font-size:12px!important;
      }

      .v95-coverage-head{
        font-size:10px!important;
      }
      .v95-coverage-line>div small{
        font-size:10px!important;
      }
      .v95-coverage-line>div strong,
      .v95-coverage-line>div span,
      .v95-coverage-line>b{
        font-size:11px!important;
        line-height:1.3;
      }

      .v98d-context span,.v98d-context em,.v98d-area-head>div:first-child>span,
      .v98d-level-head>div>span,.v98d-area-meta small,.v98d-level-meta span,
      .v98d-subject-name small,.v98d-grouping>summary small,.v98d-group>header span,
      .v98d-group em,.v99d-plans>summary small,.v99d-plan header small,
      .v99d-plan-head,.v99d-plan-empty{
        font-size:11px!important;
        line-height:1.3;
      }

      .v98d-context strong,.v98d-subject-name strong,.v98d-value b,.v98d-value span,
      .v98d-grouping>summary strong,.v98d-group h5,.v99d-plans>summary strong,
      .v99d-plan header strong,.v99d-plan-row strong,.v99d-plan-row span{
        font-size:12px!important;
        line-height:1.35;
      }

      .v73-card p,.v73-alert,.v73-ok,.v73-danger span,.v73-module-toolbar span{
        font-size:12px!important;
      }
      .v73-status{font-size:11px!important}

      .v114-plan-card p,.v114-plan-grid p,.v114-content-list p,.v114-section-head p,
      .v114-entry p,.v114-hero p{
        font-size:13px!important;
      }

      .v114-filter-grid label{font-size:12px!important}
      .v114-plan-card,.v114-readonly,.v114-criteria,.v114-excel-info{padding:14px}
      .v114-criterion textarea{min-height:110px}

      .v71m-teacher{padding:14px 46px 14px 14px}
      .v71m-cargo-line{padding:9px}
      .v110-teacher-coords{padding:10px}
      .v95-coord-row{padding:11px 12px}

      .v84cc-table{font-size:12px}
    }

    @media (max-width: 430px){
      .v95-coverage-head{font-size:10px!important}
      .v95-coverage-line>b{font-size:11px!important}
      .v38-top h2{font-size:1.05rem}
      .v38-top-actions>[data-back],.v38-top-actions>[data-back-space]{
        font-size:12px!important;
        min-height:40px;
      }
    }
  `;
  document.head.appendChild(style);
  window.PCIResponsiveLegibilityV119={installed:true};
})();