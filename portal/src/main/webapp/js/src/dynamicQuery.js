/*
 * Copyright (c) 2012 Memorial Sloan-Kettering Cancer Center.
 * This library is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published
 * by the Free Software Foundation; either version 2.1 of the License, or
 * any later version.
 *
 * This library is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  The software and
 * documentation provided hereunder is on an "as is" basis, and
 * Memorial Sloan-Kettering Cancer Center
 * has no obligations to provide maintenance, support,
 * updates, enhancements or modifications.  In no event shall
 * Memorial Sloan-Kettering Cancer Center
 * be liable to any party for direct, indirect, special,
 * incidental or consequential damages, including lost profits, arising
 * out of the use of this software and its documentation, even if
 * Memorial Sloan-Kettering Cancer Center
 * has been advised of the possibility of such damage.  See
 * the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library; if not, write to the Free Software Foundation,
 * Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA.
 */

/******************************************************************************************
* Dynamic Query Javascript, built with JQuery
* @author Ethan Cerami, Caitlin Byrne. 
*
* This code performs the following functions:
*
* 1.  Connects to the portal via AJAX and downloads a JSON document containing information
*     regarding all cancer studies and gene sets stored in the CGDS.
* 2.  Creates event handler for when user selects a cancer study.  This triggers updates
      in the genomic profiles and case lists displayed.
* 3.  Creates event handler for when user selects a gene set.  This triggers updates to the
      gene set text area.
******************************************************************************************/

// Create Constants
var PROFILE_MUTATION = "PROFILE_MUTATION";
var PROFILE_MUTATION_EXTENDED = "PROFILE_MUTATION_EXTENDED";
var PROFILE_COPY_NUMBER_ALTERATION = "PROFILE_COPY_NUMBER_ALTERATION"
var PROFILE_MRNA_EXPRESSION = "PROFILE_MRNA_EXPRESSION";
var PROFILE_PROTEIN = "PROFILE_PROTEIN";
var PROFILE_RPPA = "PROFILE_RPPA";
var PROFILE_METHYLATION = "PROFILE_METHYLATION"

var caseSetSelectionOverriddenByUser = false;

//  Create Log Function, if FireBug is not Installed.
if(typeof(console) === "undefined" || typeof(console.log) === "undefined")
    var console = { log: function() { } };

//  Triggered only when document is ready.
$(document).ready(function(){
	
     //  Load Portal JSON Meta Data while showing loader image in place of query form
     loadMetaData();

     //  Set up Event Handler for User Selecting Cancer Study from Pull-Down Menu
     $("#select_single_study").change(function() {
         caseSetSelectionOverriddenByUser = false; // reset
         console.log("#select_single_study change ( cancerStudySelected() )");
         cancerStudySelected();
         
         caseSetSelected();
         $('#custom_case_set_ids').empty(); // reset the custom case set textarea
     });

    // Set up Event Handler for User Selecting a Case Set
    $("#select_case_set").change(function() {
        caseSetSelected();
        caseSetSelectionOverriddenByUser = true;
    });

    // Set up Event Handler for User Selecting a Get Set
    $("#select_gene_set").change(function() {
        geneSetSelected();
    });

    //  Set up Event Handler for View/Hide JSON Debug Information
    $("#json_cancer_studies").click(function(event) {
      event.preventDefault();
      $('#cancer_results').toggle();
    });

    //  Set up an Event Handler to intercept form submission
    $("#main_form").submit(function() {
       return chooseAction();
    });

    //  Set up an Event Handler for the Query / Data Download Tabs
    $("#query_tab").click(function(event) {
       event.preventDefault();
        userClickedMainTab("tab_visualize")
    });
    $("#download_tab").click(function(event) {
       event.preventDefault();
       userClickedMainTab("tab_download");
    });
    
    // Set up custom case set related GUI & event handlers (step 3)
    initCustomCaseSetUI();

    //  set toggle Step 5: Optional arguments
    //$("#optional_args").hide();
    /*$("#step5_toggle").click(function(event) {
        event.preventDefault();
        $("#optional_args").toggle( "blind" );
    });*/
    
    $('.netsize_help').tipTip();

    $('#step5 > .step_header').click(function(){
         $(".ui-icon", this).toggle();
         $("#optional_args").toggle();
    });

    // unset cookie for results tabs, so that a new query
    // always goes to summary tab first
    $.cookie("results-tab",null);

});  //  end document ready function


//  Load study Meta Data, i.e. everything except the name, which we load earlier to
//  	populate the dropdown menu.
function loadStudyMetaData(cancerStudyId) {
    console.log("loadStudyMetaData ("+cancerStudyId+")");
    $('.main_query_panel').fadeTo("fast",0.6);
	
    $.getJSON("portal_meta_data.json?study_id="+cancerStudyId, function(json){
        window.metaDataJson.cancer_studies[cancerStudyId] = json;
        updateCancerStudyInformation();
        $('.main_query_panel').stop().fadeTo("fast",1);
    });
}

// Load geneset gene list
function loadGeneList(geneSetId) {
    $('.main_query_panel').fadeTo("fast",0.6);

    $.getJSON("portal_meta_data.json?geneset_id="+geneSetId.replace(/\//g,""), function(json){
        window.metaDataJson.gene_sets[geneSetId].gene_list = json.list;
        $("#gene_list").val(json.list);
        $('.main_query_panel').stop().fadeTo("fast",1);
    });
}
	
//  Load Portal JSON Meta Data, while showing loader image
function loadMetaData() {
    $('#load').remove();
    //  show ajax loader image; loader is background image of div 'load' as set in css
    $('.main_query_panel').append('<div id="load">&nbsp;</div>');
    $('#load').fadeIn('slow');

    //  hide the main query form until all meta data is loaded and added to page
    $('#main_query_form').hide('fast',loadContent);

    function loadContent() {
        //  Get Portal JSON Meta Data via JQuery AJAX
	window.metaDataPromise = $.Deferred();

        jQuery.getJSON("portal_meta_data.json?partial_studies=true&partial_genesets=true",function(json){
            //  Store JSON Data in global variable for later use
            window.metaDataJson = json;
	    window.metaDataPromise.resolve(json);

            // Load data of selected study right at the outset before continuing
            $.getJSON("portal_meta_data.json?study_id="+window.cancer_study_id_selected, function(json) {
                console.log("Loading metadata for "+window.cancer_study_id_selected);
                // this code should be about the same as in loadStudyMetaData
                window.metaDataJson.cancer_studies[window.cancer_study_id_selected] = json;
                //  Add Meta Data to current page
                addMetaDataToPage();
                showNewContent();
            });
        });
    }

    function showNewContent() {
        //show content, hide loader only after content is shown
        $('#main_query_form').fadeIn('fast', hideLoader);
    }
    function hideLoader() {
        //hide loader image
        $('#load').fadeOut('fast',removeLoader());
    }
    function removeLoader() {
        // remove loader image so that it will not appear in the
        // modify-query section on results page
        $('#load').remove();
    }
}

//  Triggered when the User Selects one of the Main Query or Download Tabs
function userClickedMainTab(tabAction) {

    //  Change hidden field value
    $("#tab_index").val(tabAction);

    //  Then, submit the form
    $("#main_form").submit();
}

//  When the page is first loaded, the default query will be a cross-cancer type
//  search in which the user will enter ONLY a gene list; Also when "All Cancer Studies"
//  is selected in Step 1
function crossCancerStudySelected() {
     $('#step2').hide();
     $('#step2cross').show();
     $('#step3').hide();
     $('#step5').hide();
     $('#cancer_study_desc').hide();
}

//  Display extra steps when an individual cancer study is selected
function singleCancerStudySelected() {
    $("#step2").show();
    $('#step2cross').hide();
    $("#step3").show();
    //$("#step5").show();
    $("#cancer_study_desc").show();
}

//  Select default genomic profiles
function makeDefaultSelections(){

    $('.' + PROFILE_MUTATION_EXTENDED).prop('checked',true);
    $('.' + PROFILE_COPY_NUMBER_ALTERATION +':checkbox').prop('checked',true);
    $('.' + PROFILE_COPY_NUMBER_ALTERATION +':radio').first().prop('checked',true);

}

// Triggered after meta data is added to page in case page is
// re-drawn after query error and also any time a new cancer
// type is selected; Assesses the need for default selections
// and sets the visibility of each step based on current selections
function reviewCurrentSelections(){

   //HACK TO DEAL WITH ASYNCHRONOUS STUFF SO WE DONT DO THIS UNTIL AFTER METADATA ADDED
   if (window.metaDataAdded === true) {  
    // Unless the download tab has been chosen or 'All Cancer Studies' is
    // selected, iterate through checkboxes to see if any are selected; if not,
    // make default selections
    if (window.tab_index !== "tab_download" && $("#select_single_study").val() !== 'all'){
         var setDefaults = true;

         // if no checkboxes are checked, make default selections
         $('#genomic_profiles input:checkbox').each(function(){
             if ($(this).prop('checked')){
                 setDefaults = false;
                 return;
             }
         });

         if (setDefaults){
             console.log("reviewCurrentSelections ( makeDefaultSelections() )");
             makeDefaultSelections();
         }
    } 

    updateDefaultCaseList();

    // determine whether mRNA threshold field should be shown or hidden
    // based on which, if any mRNA profiles are selected
    toggleThresholdPanel($("." + PROFILE_MRNA_EXPRESSION+"[type=checkbox]"), PROFILE_MRNA_EXPRESSION, "#z_score_threshold");

    // similarly with RPPA
    toggleThresholdPanel($("." + PROFILE_RPPA+"[type=checkbox]"), PROFILE_RPPA, "#rppa_score_threshold");

    // determine whether optional arguments section should be shown or hidden
 //   if ($("#optional_args > input").length >= 1){
 //       $("#optional_args > input").each(function(){
 //           if ($(this).prop('checked')){
 //               // hide/show is ugly, but not sure exactly how toggle works
 //               // and couldn't get it to work.. this will do for now
 //               $("#step5 > .step_header > .ui-icon-triangle-1-e").hide();
 //               $("#step5 > .step_header > .ui-icon-triangle-1-s").show();
 //               $("#optional_args").toggle();
 //               return;
 //           }
 //       });
 //   }
   }
}

//  Determine whether to submit a cross-cancer query or
//  a study-specific query
function chooseAction() {
    var haveExpInQuery = $("#gene_list").val().toUpperCase().search("EXP") > -1;
    $("#exp_error_box").remove();

    var selected_studies = $("#jstree").jstree(true).get_selected_leaves();
    if (selected_studies.length > 1) {
	$("#main_form").find("#select_multiple_studies").val(selected_studies.join(","));
        if ($("#tab_index").val() == 'tab_download') {
            $("#main_form").get(0).setAttribute('action','index.do');
        }
        else {
            $("#main_form").get(0).setAttribute('action','cross_cancer.do');    
        }
        if ( haveExpInQuery ) {
            createAnEXPError("Expression filtering in the gene list is not supported when doing cross cancer queries.");
            return false;
        }
    } else if (selected_studies.length === 1) {
	$("#main_form").find("#select_single_study").val(selected_studies[0]);
        $("#main_form").get(0).setAttribute('action','index.do');

        if ( haveExpInQuery ) {
            var expCheckBox = $("." + PROFILE_MRNA_EXPRESSION);

            if( expCheckBox.length > 0 && expCheckBox.prop('checked') == false) {
                    createAnEXPError("Expression specified in the list of genes, but not selected in the" +
                                        " Genetic Profile Checkboxes.");
                    return false;
            } else if( expCheckBox.length == 0 ) {
                createAnEXPError("Expression specified in the list of genes, but not selected in the" +
                                    " Genetic Profile Checkboxes.");
                return false;
            }
        }

        return true;
    } else {
	    // TODO: make error - no studies selected
	    return false;
    }
}

function createAnEXPError(errorText) {
    var errorBox = $("<div id='exp_error_box'>").addClass("ui-state-error ui-corner-all exp_error_box");
    var errorButton = $("<span>").addClass("ui-icon ui-icon-alert exp_error_button");
    var strongErrorText = $("<small>").html("Error: " + errorText + "<br>");
    var errorTextBox = $("<span>").addClass("exp_error_text");

    errorButton.appendTo(errorBox);
    strongErrorText.appendTo(errorTextBox);
    errorTextBox.appendTo(errorBox);

    errorBox.insertBefore("#gene_list");
    errorBox.slideDown();
}

//  Triggered when a genomic profile radio button is selected
function genomicProfileRadioButtonSelected(subgroupClicked) {
    var subgroupClass = subgroupClicked.attr('class');
    if (subgroupClass != undefined && subgroupClass != "") {
        var checkboxSelector = "input."+subgroupClass+"[type=checkbox]";
        if (checkboxSelector != undefined) {
            $(checkboxSelector).prop('checked',true);
        }
    }
    updateDefaultCaseList();
}

//  Triggered when a genomic profile group check box is selected.
function profileGroupCheckBoxSelected(profileGroup) {
    var profileClass = profileGroup.attr('class');
    $("input."+profileClass+"[type=radio]").prop('checked',false);
    if (profileGroup.prop('checked')) {
        var rnaSeqRadios = $("input."+profileClass+"[type=radio][value*='rna_seq']");
        if (rnaSeqRadios.length>0) {
            rnaSeqRadios.first().prop('checked',true);
        } else {
            $("input."+profileClass+"[type=radio]").first().prop('checked',true);
        }
    }
    updateDefaultCaseList();
}

// update default case list based on selected profiles
function updateDefaultCaseList() {
    if (caseSetSelectionOverriddenByUser) return;
    var mutSelect = $("input.PROFILE_MUTATION_EXTENDED[type=checkbox]").prop('checked');
    var cnaSelect = $("input.PROFILE_COPY_NUMBER_ALTERATION[type=checkbox]").prop('checked');
    var expSelect = $("input.PROFILE_MRNA_EXPRESSION[type=checkbox]").prop('checked');
    var rppaSelect = $("input.PROFILE_RPPA[type=checkbox]").prop('checked');
    var selectedCancerStudy = $('#select_single_study').val();
    var defaultCaseList = selectedCancerStudy+"_all";
    if (mutSelect && cnaSelect && !expSelect && !rppaSelect) {
        defaultCaseList = selectedCancerStudy+"_cnaseq";
        if ($("#select_case_set option[value='"+defaultCaseList+"']").length == 0) {
            defaultCaseList = selectedCancerStudy+"_cna_seq";  //TODO: Better to unify to this one
        }
    } else if (mutSelect && !cnaSelect && !expSelect && !rppaSelect) {
        defaultCaseList = selectedCancerStudy+"_sequenced";
    } else if (!mutSelect && cnaSelect && !expSelect && !rppaSelect) {
        defaultCaseList = selectedCancerStudy+"_acgh";
    } else if (!mutSelect && !cnaSelect && expSelect && !rppaSelect) {
        if ($('#'+selectedCancerStudy+'_mrna_median_Zscores').prop('checked')) {
            defaultCaseList = selectedCancerStudy+"_mrna";
        } else if ($('#'+selectedCancerStudy+'_rna_seq_mrna_median_Zscores').prop('checked')) {
            defaultCaseList = selectedCancerStudy+"_rna_seq_mrna";
        } else if ($('#'+selectedCancerStudy+'_rna_seq_v2_mrna_median_Zscores').prop('checked')) {
            defaultCaseList = selectedCancerStudy+"_rna_seq_v2_mrna";
        }
    } else if ((mutSelect || cnaSelect) && expSelect && !rppaSelect) {
        defaultCaseList = selectedCancerStudy+"_3way_complete";
    } else if (!mutSelect && !cnaSelect && !expSelect && rppaSelect) {
        defaultCaseList = selectedCancerStudy+"_rppa";
    }
    
    $('#select_case_set').val(defaultCaseList);
    
    // HACKY CODE START -- TO SOLVE THE PROBLEM THAT WE HAVE BOTH _complete and _3way_complete
    if (!$('#select_case_set').val()) {
        if (defaultCaseList===selectedCancerStudy+"_3way_complete") {
            $('#select_case_set').val(selectedCancerStudy+"_complete");
        }
    }// HACKY CODE END
    
    if (!$('#select_case_set').val()) {     
        // in case no match
        $('#select_case_set').val(selectedCancerStudy+"_all");
    }
    
    updateCaseListSmart();
}

//  Print message and disable submit if use choosed a cancer type
//  for which no genomic profiles are available
function genomicProfilesUnavailable(){
    $("#genomic_profiles").html("<strong>No Genomic Profiles available for this Cancer Study</strong>");
    $('#main_submit').attr('disabled',true);
}

// Show or hide mRNA threshold field based on mRNA profile selected
function toggleThresholdPanel(profileClicked, profile, threshold_div) {
    var selectedProfile = profileClicked.val();
    var inputType = profileClicked.attr('type');

    // when a radio button is clicked, show threshold input unless user chooses expression outliers
    if(inputType == 'radio'){
        if(selectedProfile.indexOf("outlier")==-1){
            $(threshold_div).slideDown();
        } else {
            $(threshold_div).slideUp();
        }
    } else if(inputType == 'checkbox'){

        // if there are NO subgroups, show threshold input when mRNA checkbox is selected.
        if (profileClicked.prop('checked')){
            $(threshold_div).slideDown();
        }
        // if checkbox is unselected, hide threshold input regardless of whether there are subgroups
        else {
            $(threshold_div).slideUp();
        }
    }
}

// toggle:
//      gistic button
//      mutsig button
// according to the cancer_study
function toggleByCancerStudy(cancer_study) {
    var mutsig = $('#toggle_mutsig_dialog');
    var gistic = $('#toggle_gistic_dialog_button');
    if (cancer_study.has_mutsig_data) {
        mutsig.show();
    } else {
        mutsig.hide();
    }
    if (cancer_study.has_gistic_data) {
        gistic.show();
    } else {
        gistic.hide();
    }
}

function updateCaseListSmart() {
    $("#select_case_set").trigger("liszt:updated");
    $("#select_case_set_chzn .chzn-drop ul.chzn-results li")
        .each(function(i, e) {
            $(e).qtip({
                content: "<font size='2'>" + $($("#select_case_set option")[i]).attr("title") + "</font>",
                style: {
                    classes: 'qtip-light qtip-rounded qtip-shadow qtip-lightyellow'
                },
                position: {
                    my: 'left middle',
                    at: 'middle right',
                    viewport: $(window)
                },
	            show: "mouseover",
	            hide: "mouseout"
            });
        }
    );
}

// Called when and only when a cancer study is selected from the dropdown menu
function updateCancerStudyInformation() {
    var cancerStudyId = $("#main_form").find("#select_single_study").val();
    var cancer_study = window.metaDataJson.cancer_studies[cancerStudyId];

    // toggle every time a new cancer study is selected
    toggleByCancerStudy(cancer_study);

    if (cancerStudyId=='all'){
        crossCancerStudySelected();
        return;
    }

    //  Update Cancer Study Description
    var citation = cancer_study.citation;
    if (!citation) {
        citation="";
    }
    else {
        var pmid = cancer_study.pmid;
        if (pmid) {
            citation = " <a href='http://www.ncbi.nlm.nih.gov/pubmed/"+pmid+"'>"+citation+"</a>";
        }
    }
    var cancerStudyForm = " <button type='button' onclick=\"window.location.replace('study.do?cancer_study_id="
        +cancerStudyId+"')\">Study summary</button>";
    $("#cancer_study_desc").html("<p> " + cancer_study.description + citation + cancerStudyForm + "</p>");

    //  Iterate through all genomic profiles
    //  Add all non-expression profiles where show_in_analysis_tab = true
    //  First, clear all existing options
    $("#genomic_profiles").html("");

    //  Add Genomic Profiles, in this order
    addGenomicProfiles(cancer_study.genomic_profiles, "MUTATION", PROFILE_MUTATION, "Mutation");
    addGenomicProfiles(cancer_study.genomic_profiles, "MUTATION_EXTENDED", PROFILE_MUTATION_EXTENDED, "Mutation");
    addGenomicProfiles(cancer_study.genomic_profiles, "COPY_NUMBER_ALTERATION", PROFILE_COPY_NUMBER_ALTERATION, "Copy Number");
    addGenomicProfiles(cancer_study.genomic_profiles, "PROTEIN_LEVEL", PROFILE_PROTEIN, "Protein Level");
    addGenomicProfiles(cancer_study.genomic_profiles, "MRNA_EXPRESSION", PROFILE_MRNA_EXPRESSION, "mRNA Expression");
    addGenomicProfiles(cancer_study.genomic_profiles, "METHYLATION", PROFILE_METHYLATION, "DNA Methylation");
    addGenomicProfiles(cancer_study.genomic_profiles, "METHYLATION_BINARY", PROFILE_METHYLATION, "DNA Methylation");
    addGenomicProfiles(cancer_study.genomic_profiles, "PROTEIN_ARRAY_PROTEIN_LEVEL", PROFILE_RPPA, "Protein/phosphoprotein level (by RPPA)");


    //  if no genomic profiles available, set message and disable submit button
    if ($("#genomic_profiles").html()==""){
        console.log("cancerStudySelected ( genomicProfilesUnavailable() )");
        genomicProfilesUnavailable();
    }

    //  Update the Case Set Pull-Down Menu
    //  First, clear all existing pull-down menus
    $("#select_case_set").html("");

    //  Iterate through all case sets
    //  Add each case set as an option, and include description as title, so that it appears
    //  as a tool-tip.
    jQuery.each(cancer_study.case_sets,function(i, case_set) {
        $("#select_case_set").append("<option class='case_set_option' value='"
                + case_set.id + "' title='"
                + case_set.description + "'>" + case_set.name + " ("+ case_set.size +")" + "</option>");
    }); //  end for each case study loop

    //  Add the user-defined case list option
    $("#select_case_set").append("<option class='case_set_option' value='-1' "
        + "title='Specify you own case list'>User-defined Case List</option>");
    updateCaseListSmart();

    //  Set up Tip-Tip Event Handler for Case Set Pull-Down Menu
    //  commented out for now, as this did not work in Chrome or Safari
    //  $(".case_set_option").tipTip({defaultPosition: "right", delay:"100", edgeOffset: 25});

    //  Set up Tip-Tip Event Handler for Genomic Profiles help
    $(".profile_help").tipTip({defaultPosition: "right", delay:"100", edgeOffset: 25});

    //  Set up Event Handler for user selecting a genomic profile radio button
    $("input[type='radio'][name*='genetic_profile_']").click(function(){
        genomicProfileRadioButtonSelected($(this));
    });

    //  Set up an Event Handler for user selecting a genomic profile checkbox
    $("input[type='checkbox'][class*='PROFILE_']").click(function(){
        profileGroupCheckBoxSelected($(this));
    });

    //  Set up an Event Handler for showing/hiding mRNA threshold input
    $("." + PROFILE_MRNA_EXPRESSION).click(function(){
       toggleThresholdPanel($(this), PROFILE_MRNA_EXPRESSION, "#z_score_threshold");
    });

    //  Set up an Event Handler for showing/hiding RPPA threshold input
    $("." + PROFILE_RPPA).click(function(){
       toggleThresholdPanel($(this), PROFILE_RPPA, "#rppa_score_threshold");
    });

    // Set default selections and make sure all steps are visible
    console.log("cancerStudySelected ( singleCancerStudySelected() )");
    singleCancerStudySelected();
    console.log("cancerStudySelected ( reviewCurrentSelections() )");
    reviewCurrentSelections();
    // check if cancer study has a clinical_free_form data to filter,
    // if there is data to filter, then enable "build custom case set" link,
    // otherwise disable the button
    jQuery.getJSON("ClinicalFreeForm.json",
		{studyId: $("#select_single_study").val()},
		function(json){
			var noDataToFilter = false;
			
			if (json.freeFormData.length == 0)
			{
				noDataToFilter = true;
			}
			else
			{
				noDataToFilter = true;
				
				var categorySet = json.categoryMap;
				
				// check if there is at least one category to filter
		    	for (var category in categorySet)
		    	{
		    		// continue if the category is qualified as a filter parameter
		    		if (isEligibleForFiltering(categorySet[category]))
		    		{
		    			noDataToFilter = false;
		    			break;
		    		}
		    	}
			}
			
			if (noDataToFilter)
			{
				// no clinical_free_form data to filter for the current
				// cancer study, so disable the button
				$("#build_custom_case_set").hide();
			}
			else
			{
				$("#build_custom_case_set").tipTip({defaultPosition: "right",
					delay:"100",
					edgeOffset: 10,
					maxWidth: 100});
				
				$("#build_custom_case_set").hide();//.show(); temporarily disabled build case list
			}
		});
}
//  Triggered when a cancer study has been selected, either by the user
//  or programatically.
function cancerStudySelected() {

    //  make sure submit button is enabled unless determined otherwise by lack of data
    $("#main_submit").attr("disabled",false);

    var cancerStudyId = $("#select_single_study").val() || "all";

    if (window.metaDataJson.cancer_studies[cancerStudyId].partial==="true") {
            console.log("cancerStudySelected( loadStudyMetaData )");
	    loadStudyMetaData(cancerStudyId);
    } else {
	    updateCancerStudyInformation();
    }
}

//  Triggered when a case set has been selected, either by the user
//  or programatically.
function caseSetSelected() {
    var caseSetId = $("#select_case_set").val();

    //  If user has selected the user-defined option, show the case list div
    //  Otherwise, make sure to hide it.
    if (caseSetId == "-1") {
        $("#custom_case_list_section").show();
        // if custom case list was selected, post to avoid long url problem.
        $("#main_form").attr("method","post");
    } else {
        $("#custom_case_list_section").hide();
        $("#main_form").attr("method","get");
    }
}

//  Triggered when a gene set has been selected, either by the user
//  or programatically.
function geneSetSelected() {
    //  Get the selected ID from the pull-down menu
    var geneSetId = $("#select_gene_set").val();

    if (window.metaDataJson.gene_sets[geneSetId].gene_list == "") {
        loadGeneList(geneSetId);
    } else {
        //  Get the gene set meta data from global JSON variable
        var gene_set = window.metaDataJson.gene_sets[geneSetId];

        //  Set the gene list text area
        $("#gene_list").val(gene_set.gene_list);
    }
}

//  Adds Meta Data to the Page.
//  Tiggered at the end of successful AJAX/JSON request.
function addMetaDataToPage() {
    console.log("Adding Meta Data to Query Form");
    json = window.metaDataJson;


    // Construct oncotree
    var oncotree = {'tissue':{code:'tissue', studies:[], children:[], parent: false, desc_studies_count:0, tissue:''}};
    var parents = json.parent_type_of_cancers;
    // First add everything to the tree
    for (var tumortype in parents) {
	if (parents.hasOwnProperty(tumortype)) {
		oncotree[tumortype] = {code:tumortype, studies:[], children:[], parent: false, desc_studies_count: 0, tissue: false};
	}
    }
    // Link parents and insert initial tissue info
    for (var tumortype in oncotree) {
	if (oncotree.hasOwnProperty(tumortype) && tumortype !== 'tissue') {
		oncotree[tumortype].parent = oncotree[parents[tumortype]];
		oncotree[tumortype].parent.children.push(oncotree[tumortype]);
		if (parents[tumortype] === "tissue") {
			oncotree[tumortype].tissue = tumortype;
		}
	}
    }
    // Insert tissue information in a "union-find" type way
    for (var elt in oncotree) {
        if (oncotree.hasOwnProperty(elt) && elt !== 'tissue') {
            var to_modify = [];
            var currelt = oncotree[elt];
            while (!currelt.tissue && currelt.code !== 'tissue') {
                to_modify.push(currelt);
                currelt = currelt.parent;
            }
            for (var i=0; i<to_modify.length; i++) {
                to_modify[i].tissue = currelt.tissue;
            }
        }
    }
    // Add studies to tree, and climb up adding one to each level's descendant studies
    // DMP hack
    var dmp_studies = [];
    for (var study in json.cancer_studies) {
	if (study.indexOf("mskimpact") !== -1) {
		// DMP hack
		dmp_studies.push(study);
	} else if (json.cancer_studies.hasOwnProperty(study) && study !== 'all') { // don't re-add 'all'
            try {
                var code = json.cancer_studies[study].type_of_cancer.toLowerCase();
                oncotree[code].studies.push(study);
                var node = oncotree[code];
                while (node) {
                    node.desc_studies_count += 1;
                    node = node.parent;
                }
            } catch (err) {
                console.log("Unable to add study");
                console.log(json.cancer_studies[study]);
            }
        }
    }
    // Sort dmp by number if there is one in the name
    dmp_studies.sort(function(a,b) {
	var matchA = a.match(/\d+/);
	var matchB = b.match(/\d+/);
	var numberA = (matchA === null ? NaN : parseInt(a.match(/\d+/)[0], 10));
	var numberB = (matchB === null ? NaN : parseInt(b.match(/\d+/)[0], 10));
	if (isNaN(numberA) && isNaN(numberB)) {
		return a.localeCompare(b);
	} else if (isNaN(numberA)) {
		return -1;
	} else if (isNaN(numberB)) {
		return 1;
	} else {
		return numberA-numberB;
	}
    });
    dmp_studies.reverse();
    // Sort all the children alphabetically
    for (var node in oncotree) {
        if (oncotree.hasOwnProperty(node)) {
            oncotree[node].children.sort(function(a,b) {
                try {
                    return json.type_of_cancers[a.code].localeCompare(json.type_of_cancers[b.code]);
                } catch(err) {
                    return a.code.localeCompare(b.code);
                }
            });
            oncotree[node].studies.sort(function(a,b) {
                return a.localeCompare(b);
            });
        }
    }
    var splitAndCapitalize = function(s) {
	    return s.split("_").map(function(x) { return (x.length > 0 ? x[0].toUpperCase()+x.slice(1) : x);}).join(" ");
    }
    var jstree_root_id = 'tissue';
    var jstree_data = [];
    jstree_data.push({'id':jstree_root_id, parent:'#', text:'All', state:{opened:true}, li_attr:{name:'All'}});
    var node_queue = [].concat(oncotree['tissue'].children);
    var currNode;
    if (dmp_studies.length > 0) {
	jstree_data.push({'id':'mskimpact-study-group', 'parent':jstree_root_id, 'text':'MSKCC DMP', 'li_attr':{name:'MSKCC DMP'}});
	$.each(dmp_studies, function(ind, id) {
		jstree_data.push({'id':id, 'parent':'mskimpact-study-group', 'text':json.cancer_studies[id].name, 
			'li_attr':{name: json.cancer_studies[id].name, description: metaDataJson.cancer_studies[id].description}});
	});
    }
    while (node_queue.length > 0) {
	    currNode = node_queue.shift();
	    if (currNode.desc_studies_count > 0) {
		var name = splitAndCapitalize(metaDataJson.type_of_cancers[currNode.code] || currNode.code);
		jstree_data.push({'id':currNode.code, 
			'parent':((currNode.parent && currNode.parent.code) || '#'), 
			'text':name,
			'li_attr':{name:name}
		});
		
		$.each(currNode.studies, function(ind, elt) {
			    name = splitAndCapitalize(metaDataJson.cancer_studies[elt].name);
			    jstree_data.push({'id':elt, 
				    'parent':currNode.code, 
				    'text':name,
				    'li_attr':{name: name, description:metaDataJson.cancer_studies[elt].description}});
		});
		node_queue = node_queue.concat(currNode.children);
	    }
    }
    var precomputed_search = {query: '', results: {}};
    var parse_search_query = function(query) {
		// First eliminate trailing whitespace and reduce every whitespace
		//	to a single space.
		query = query.toLowerCase().trim().split(/\s+/g).join(' ');
		// Now factor out quotation marks and inter-token spaces
		var phrases = [];
		var currInd = 0;
		var nextSpace, nextQuote;
		while (currInd < query.length) {
			if (query[currInd] === '"') {
				nextQuote = query.indexOf('"', currInd+1);
				if (nextQuote === -1) {
					phrases.push(query.substring(currInd + 1));
					currInd = query.length;
				} else {
					phrases.push(query.substring(currInd + 1, nextQuote));
					currInd = nextQuote + 1;
				}
			} else if (query[currInd] === ' ') {
				currInd += 1;
			} else if (query[currInd] === '-') {
				phrases.push('-');
				currInd += 1;
			} else {
				nextSpace = query.indexOf(' ', currInd);
				if (nextSpace === -1) {
					phrases.push(query.substring(currInd));
					currInd = query.length;
				} else {
					phrases.push(query.substring(currInd, nextSpace));
					currInd = nextSpace + 1;
				}
			}
		}
		// Now get the conjunctive clauses, and the negative clauses
		var clauses = [];
		currInd = 0;
		var nextOr, nextDash;
		while (currInd < phrases.length) {
			if (phrases[currInd] === '-') {
				if (currInd < phrases.length - 1) {
					clauses.push({"type":"not", "data":phrases[currInd+1]});
				}
				currInd = currInd + 2;
			} else {
				nextOr = phrases.indexOf('or', currInd);
				nextDash = phrases.indexOf('-', currInd);
				if (nextOr === -1 && nextDash === -1) {
					clauses.push({"type":"and","data":phrases.slice(currInd)});
					currInd = phrases.length;
				} else if (nextOr === -1 && nextDash > 0) {
					clauses.push({"type":"and", "data":phrases.slice(currInd, nextDash)});
					currInd = nextDash;
				} else if (nextOr > 0 && nextDash === -1) {
					clauses.push({"type":"and", "data":phrases.slice(currInd, nextOr)});
					currInd = nextOr + 1;
				} else {
					if (nextOr < nextDash) {
						clauses.push({"type":"and", "data":phrases.slice(currInd, nextOr)});
						currInd = nextOr + 1;
					} else {
						clauses.push({"type":"and", "data":phrases.slice(currInd, nextDash)});
						currInd = nextDash;
					}
				}
			}
		}	
		return clauses;
    };
    var perform_search_single = function(parsed_query, node) {
	    // in: a jstree node
	    // text to search is node.text and node.li_attr.description
	    // return true iff the query, considering quotation marks, 'and' and 'or' logic, matches
	    // TODO: do actual logic
	    var match = false;
	    var hasPositiveClauseType = false;
	    var forced = false;
	    var matchPhrase = function(phrase, node) {
		    return (node.li_attr && node.li_attr.name && node.li_attr.name.toLowerCase().indexOf(phrase) > -1) 
			    || (node.li_attr && node.li_attr.description && node.li_attr.description.toLowerCase().indexOf(phrase) > -1);
	    };
	    $.each(parsed_query, function(ind, clause) {
		    if (clause.type !== 'not') {
			    hasPositiveClauseType = true;
			    return 0;
		    }
	    });
	    if (!hasPositiveClauseType) {
		    // if only negative clauses, match by default
		    match = true;
	    }
	    $.each(parsed_query, function(ind, clause) {
		    if (clause.type === 'not') {
			    if (matchPhrase(clause.data, node)) {
				    match = false;
				    forced = true;
				    return 0;
			    }
		    } else if (clause.type === 'and') {
			    hasPositiveClauseType = true;
			    var clauseMatch = true;
			    $.each(clause.data, function(ind2, phrase) {
				    clauseMatch = clauseMatch && matchPhrase(phrase, node);
			    });
			    match = match || clauseMatch;
		    }
	    });
	    return {result:match, forced:forced};
    };
    var perform_search = function(query) {
	    // IN: query, a string
	    // void method
	    // when this ends, the object precomputed_search has been updated
	    //	so that results[node.id] = true iff the query directly matches it
	    var parsed_query = parse_search_query(query);
	    $.each($('#jstree').jstree(true)._model.data, function(key, node) {
		    precomputed_search.results[node.id] = perform_search_single(parsed_query, node);
	    });
	    precomputed_search.query = query;
    };
    var jstree_search = function(query, node) {
	    if (query === "") {
		    return true;
	    }
	    if (precomputed_search.query !== query) {
		    perform_search(query);
	    }
	    if (!precomputed_search.results[node.id].result && precomputed_search.results[node.id].forced) {
		    return false;
	    }
	    var nodes_to_consider = [node.id].concat(node.parents.slice());
	    var ret = false;
	    $.each(nodes_to_consider, function(ind, elt) {
		    if (elt === jstree_root_id || elt === '#') {
			    return 0;
		    }
		    if (!precomputed_search.results[elt].result && precomputed_search.results[elt].forced) {
			    ret = false;
			    return 0;
		    }
		    ret = ret || precomputed_search.results[elt].result;
	    });
	    return ret;
    };
    console.log("Initializing jstree");
    $("#jstree").jstree({
      "themes": {
        "theme": "default",
        "dots": false,
        "icons": false,
        "url": "../../css/jstree.style.css"
      },
	"plugins" : ['checkbox', 'search', 'wholerow'],
	"search": {'show_only_matches':true, 
		'search_callback': jstree_search,
		'search_leaves_only': true},
	"checkbox": {},
	'core': {'data':jstree_data, 'check_callback': true, 'dblclick_toggle':false}
	});
	var jstree_search_timeout = null;
	$("#jstree_search_input").on('input', function() {
		if (jstree_search_timeout) {
			clearTimeout(jstree_search_timeout);
		}
		jstree_search_timeout = setTimeout(function() {
			$("#jstree").jstree(true).search($("#jstree_search_input").val());
		}, 400); // wait for a bit with no typing before searching
	});
	$("#jstree_cellline_btn").text('Omit cell line studies');
	$("#jstree_cellline_btn").click(function(evt) {
		evt.preventDefault();
		var inp = $("#jstree_search_input");
		inp.val(inp.val()+' -"cell line"');
		$("#jstree_search_input").trigger('input');
	});
	$("#jstree_tcga_btn").text('Omit TCGA studies');
	$("#jstree_tcga_btn").click(function(evt) {
		evt.preventDefault();
		var inp = $("#jstree_search_input");
		inp.val(inp.val()+' -tcga');
		$("#jstree_search_input").trigger('input');
		
	});
	$('#jstree').on('changed.jstree', function() {
		var select_single_study = $("#main_form").find("#select_single_study");
		var select_multiple_studies = $("#main_form").find("#select_multiple_studies");
		var selected_studies = $("#jstree").jstree(true).get_selected_leaves();
		var all_ct = $("#jstree").jstree(true).get_leaves().length;
		var selected_ct = selected_studies.length;
		$('#jstree_selected_study_count').html((selected_ct === 0 ? "No" : (selected_ct === all_ct ? "All" : selected_ct))+" stud"+(selected_ct === 1 ? "y" : "ies")+" selected.");
		if (selected_studies.length === 1) {
			select_single_study.val(selected_studies[0]);
		} else if (selected_studies.length > 1) {
			select_single_study.val("all");
		} else {
			select_single_study.val("all");
		}
		select_multiple_studies.val(selected_studies.join(","));
		select_single_study.trigger('change');
		select_multiple_studies.trigger('change');
	});
	$('#jstree').jstree(true).hide_icons();
	

    //  Add Gene Sets to Pull-down Menu
    jQuery.each(json.gene_sets,function(key,gene_set){
        $("#select_gene_set").append("<option value='" + key + "'>"
                + gene_set.name + "</option>");
    });  //  end for each gene set loop

    // Set the placeholder for the autocomplete select box
    $("#example_gene_set").children("span:first").children("input:first")
        .attr("placeholder", $("#select_gene_set").children("option:first").text());

    //  Set things up, based on currently selected cancer type
    var selected_study_map = {};
    var windowParams = window.location.search.substring(1).split("&");
    $.each(windowParams, function(ind, elt) {
	    var pair = elt.split("=");
	    if (pair[0] === window.cancer_study_list_param) {
		    window.selected_cancer_study_list = pair[1];
		    return 0;
	    }
    });
    if (window.cancer_study_id_selected === 'all') {
	    var selected_study_list = decodeURIComponent(window.selected_cancer_study_list || '').split(",");
	    $.each(selected_study_list, function(ind, elt) {
		    if (elt !== '') {
			selected_study_map[elt] = false;
		}
	    });
    } else {
	    selected_study_map[window.cancer_study_id_selected] = false;
    }
    jQuery.each(json.cancer_studies,function(key,cancer_study){
        // Set Selected Cancer Type, Based on User Parameter
        if (selected_study_map.hasOwnProperty(key)) {
		selected_study_map[key] = true;
	}
    });
	$("#jstree").on('ready.jstree', function() {
		$.each(selected_study_map, function(key, val) {
			if (val) {
				$("#jstree").jstree(true).select_node(key);
			}
		});
		//   Set things up, based on currently selected case set id
		if (window.case_set_id_selected != null && window.case_set_id_selected != "") {
			$("#select_case_set").val(window.case_set_id_selected);
			caseSetSelectionOverriddenByUser = true;
		}
		caseSetSelected();

		//  Set things up, based on currently selected gene set id
		if (window.gene_set_id_selected != null && window.gene_set_id_selected != "") {
			$("#select_gene_set").val(window.gene_set_id_selected);
		} else {
			$("#select_gene_set").val("user-defined-list");
		}
		//  Set things up, based on all currently selected genomic profiles

		//  To do so, we iterate through all input elements with the name = 'genetic_profile_ids*'
		$("input[name^=genetic_profile_ids]").each(function (index) {
			//  val() is the value that or stable ID of the genetic profile ID
			var currentValue = $(this).val();

			//  if the user has this stable ID already selected, mark it as checked
			if (window.genomic_profile_id_selected[currentValue] == 1) {
				console.log("Checking " + $(this).attr('id') + "... (inside addMetaDataToPage())");
				$(this).prop('checked', true);
				//  Select the surrounding checkbox
				genomicProfileRadioButtonSelected($(this));
			}
		});  //  end for each genomic profile option


		// HACK TO DEAL WITH ASYNCHRONOUS STUFF
		window.metaDataAdded = true;
		// determine whether any selections have already been made
		// to make sure all of the fields are shown/hidden as appropriate
		console.log("addMetaDataToPage ( reviewCurrentSelections() )");
		reviewCurrentSelections();
	});

    

    // Chosenize the select boxes
    var minSearchableItems = 10;
    $("#select_gene_set").chosen({ width: '620px', search_contains: true});
    $("#select_case_set").chosen({ width: '420px', disable_search_threshold: minSearchableItems, search_contains: true });
}

// Adds the specified genomic profiles to the page.
// Code checks for three possibilities:
// 1.  0 profiles of targetType --> show nothing
// 2.  1 profile of targetType --> show as checkbox
// 3.  >1 profiles of targetType --> show group checkbox plus radio buttons
function addGenomicProfiles (genomic_profiles, targetAlterationType, targetClass, targetTitle) {
    var numProfiles = 0;
    var profileHtml = "";
    var downloadTab = false;

    //  Determine whether we are in the download tab
    if (window.tab_index == "tab_download") {
        downloadTab = true;
    }

    //  First count how many profiles match the targetAltertion type
    jQuery.each(genomic_profiles,function(key, genomic_profile) {
        if (genomic_profile.alteration_type == targetAlterationType) {
            if (downloadTab || genomic_profile.show_in_analysis_tab == true) {
                numProfiles++;
            }
        }
    }); //  end for each genomic profile loop

    if (numProfiles == 0) {
        return;
    } else if(numProfiles >1 && downloadTab == false) {
        // enable submit button
        $('#main_submit').attr('disabled', false);
        //  If we have more than 1 profile, output group checkbox
        //  assign a class to associate the checkbox with any subgroups (radio buttons)
        profileHtml += "<input type='checkbox' class='" + targetClass + "'>"
         + targetTitle + " data."
            + " Select one of the profiles below:";
        profileHtml += "<div class='genomic_profiles_subgroup'>";
    }

    //  Iterate through all genomic profiles
    jQuery.each(genomic_profiles,function(key, genomic_profile) {

        if (genomic_profile.alteration_type == targetAlterationType) {
            if (downloadTab || genomic_profile.show_in_analysis_tab == true) {
                //  Branch depending on number of profiles
                var optionType = "checkbox";
                if (downloadTab) {
                    optionType = "radio";
                } else {
                    if (numProfiles == 1) {
                        optionType = "checkbox";
                    } else if (numProfiles > 1) {
                        optionType = "radio";
                    }
                }
                profileHtml += outputGenomicProfileOption (downloadTab, optionType,
                        targetClass, genomic_profile.id, genomic_profile.name, genomic_profile.description);
            }
        }
    }); //  end for each genomic profile loop

    if(numProfiles >1) {
        //  If we have more than 1 profile, output the end div tag
        profileHtml += "</div>";
    }

    if(targetClass == PROFILE_MRNA_EXPRESSION && downloadTab == false){
        var inputName = 'Z_SCORE_THRESHOLD';
        profileHtml += "<div id='z_score_threshold' class='score_threshold'>Enter a z-score threshold &#177: "
        + "<input type='text' name='" + inputName + "' size='6' value='"
                + window.zscore_threshold + "'>"
        + "</div>";
    }

    if(targetClass == PROFILE_RPPA && downloadTab == false){
        var inputName = 'RPPA_SCORE_THRESHOLD';
        profileHtml += "<div id='rppa_score_threshold' class='score_threshold'>Enter a RPPA z-score threshold &#177: "
        + "<input type='text' name='" + inputName + "' size='6' value='"
                + window.rppa_score_threshold + "'>"
        + "</div>";
    }
    
    $("#genomic_profiles").append(profileHtml);
}

// Outputs a Single Genomic Profile Options
function outputGenomicProfileOption (downloadTab, optionType, targetClass, id, name,
                     description) {
    //  This following if/else requires some explanation.
    //  If we are in the download tab, all the input fields must use the same name.
    //  This enforces all inputs to work as a single group of radio buttons.
    //  If we are in the query tab, the input fields must be specified by alteration type.
    //  This enforces all the inputs of the same alteration type to work as a single group of radio
    //  buttons.
    var paramName;
    if (downloadTab) {
        paramName =  "genetic_profile_ids";
    } else {
        paramName = "genetic_profile_ids_" + targetClass;
    }

    var html =  "<input type='" + optionType + "' "
        + "id='" + id + "'"
        + " name='" + paramName + "'"
        + " class='" + targetClass + "'"
        + " value='" + id +"'>" + name + "</input>"
        + "  <img class='profile_help' src='images/help.png' title='"
        + description + "'><br/>";
    return html;
}

