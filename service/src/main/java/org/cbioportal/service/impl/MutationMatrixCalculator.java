package org.cbioportal.service.impl;

import org.cbioportal.persistence.MutationRepository;
import org.cbioportal.service.impl.util.MutSigUtil;
import org.mskcc.cbio.portal.dao.*;
import org.mskcc.cbio.portal.model.*;
import org.mskcc.cbio.portal.model.converter.MutationModelConverter;
import org.mskcc.cbio.portal.util.AlterationUtil;
import org.mskcc.cbio.portal.util.InternalIdUtil;
import org.mskcc.cbio.portal.util.MyCancerGenomeLinkUtil;
import org.mskcc.cbio.portal.util.OncokbHotspotUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.*;

@Component
public class MutationMatrixCalculator {

    private static final String DRUG_TYPE_FDA_ONLY = "fda_approved";
    public static final String FUSION = "fusion";
    public static final String MUT = "MUT";

    @Autowired
    private MutationRepository mutationRepository;
    @Autowired
    private MutationModelConverter mutationModelConverter;
    @Autowired
    private MutSigUtil mutSigUtil;
    @Autowired
    private AlterationUtil alterationUtil;

    public Map<String, List> calculate(List<String> sampleStableIds, String mutationGeneticProfileStableId,
                                       String mrnaGeneticProfileStableId, String cnaGeneticProfileStableId,
                                       String drugType) throws DaoException, IOException {

        Map<String, List> data = initMap();
        Map<Long, Map<String, Object>> mrnaContext = Collections.emptyMap();
        Map<Long, String> cnaContext = Collections.emptyMap();

        GeneticProfile mutationProfile = DaoGeneticProfile.getGeneticProfileByStableId(mutationGeneticProfileStableId);
        if (mutationProfile == null) {
            return data;
        }

        CancerStudy cancerStudy = DaoCancerStudy.getCancerStudyByInternalId(mutationProfile.getCancerStudyId());
        List<ExtendedMutation> mutations = mutationModelConverter.convert(mutationRepository.getMutations(
                InternalIdUtil.getInternalSampleIds(cancerStudy.getInternalId(), sampleStableIds),
                mutationProfile.getGeneticProfileId()));

        Map<Long, Set<CosmicMutationFrequency>> cosmic = DaoCosmicData.getCosmicForMutationEvents(mutations);

        DaoGeneOptimized daoGeneOptimized = DaoGeneOptimized.getInstance();
        Map<Long, Set<String>> drugs = getDrugs(mutations,
                drugType != null && drugType.equalsIgnoreCase(DRUG_TYPE_FDA_ONLY));

        Map<String, Integer> geneContextMap = getGeneContextMap(mutations, mutationProfile.getGeneticProfileId(),
                daoGeneOptimized);
        Map<String, Integer> keywordContextMap = getKeywordContextMap(mutations, mutationProfile.getGeneticProfileId());
        Sample sample = (sampleStableIds.size() == 1) ?
                DaoSample.getSampleByCancerStudyAndSampleId(cancerStudy.getInternalId(), sampleStableIds.get(0)) : null;

        if (mrnaGeneticProfileStableId != null && sample != null) {
            List<Long> entrezGeneIds = new ArrayList<>();
            for (ExtendedMutation extendedMutation : mutations) {
                entrezGeneIds.add(extendedMutation.getEntrezGeneId());
            }
            mrnaContext = alterationUtil.getMrnaContext(sample.getInternalId(), entrezGeneIds,
                    mrnaGeneticProfileStableId);
        }

        if (cnaGeneticProfileStableId != null && sampleStableIds.size() == 1) {
            cnaContext = getCnaContext(sample, mutations, cnaGeneticProfileStableId);
        }

        Map<Long, Integer> mapMutationEventIndex = new HashMap<>();
        for (ExtendedMutation mutation : mutations) {

            List<String> mcgLinks;
            if (mutation.getMutationType().equalsIgnoreCase(FUSION)) {
                mcgLinks = MyCancerGenomeLinkUtil.getMyCancerGenomeLinks(mutation.getGeneSymbol(), FUSION, false);
            } else {
                mcgLinks = MyCancerGenomeLinkUtil.getMyCancerGenomeLinks(mutation.getGeneSymbol(),
                        mutation.getProteinChange(), false);
            }

            exportMutation(data, mapMutationEventIndex, mutation, cancerStudy,
                    drugs.get(mutation.getEntrezGeneId()), geneContextMap.get(mutation.getGeneSymbol()),
                    mutation.getKeyword() == null ? 1 : keywordContextMap.get(mutation.getKeyword()),
                    cosmic.get(mutation.getMutationEventId()),
                    mrnaContext.get(mutation.getEntrezGeneId()),
                    cnaContext.get(mutation.getEntrezGeneId()),
                    mcgLinks);
        }

        return data;
    }

    private Map<Long, Set<String>> getDrugs(List<ExtendedMutation> mutations, boolean fdaOnly)
            throws DaoException {

        DaoDrugInteraction daoDrugInteraction = DaoDrugInteraction.getInstance();
        List<Integer> result = getGenesOfMutations(mutations);

        Set<Long> genes = new HashSet<>();
        for (Integer eventId : result) {
            genes.add(eventId.longValue());
        }

        Map<Long, Set<Long>> mapTargetToEventGenes = new HashMap<>();
        Set<Long> moreTargets = new HashSet<>();
        for (long gene : genes) {
            Set<Long> targets = daoDrugInteraction.getMoreTargets(gene, MUT);
            moreTargets.addAll(targets);
            alterationUtil.addEventGenes(mapTargetToEventGenes, gene, targets);
        }
        genes.addAll(moreTargets);

        Map<Long, List<String>> map = daoDrugInteraction.getDrugs(genes, fdaOnly, !fdaOnly);
        Map<Long, Set<String>> ret = new HashMap<>(map.size());
        for (Map.Entry<Long, List<String>> entry : map.entrySet()) {
            ret.put(entry.getKey(), new HashSet<>(entry.getValue()));
        }

        alterationUtil.addDrugs(mapTargetToEventGenes, map, ret);

        return ret;
    }

    private List<Integer> getGenesOfMutations(List<ExtendedMutation> mutations) {
        List<Integer> intEventIds = getMutationEventIds(mutations);

        return mutationRepository.getGenesOfMutations(intEventIds);
    }

    private Map<Long, String> getCnaContext(Sample sample, List<ExtendedMutation> mutations,
                                            String cnaProfileId) throws DaoException {

        Map<Long, String> mapGeneCna = new HashMap<>();
        DaoGeneticAlteration daoGeneticAlteration = DaoGeneticAlteration.getInstance();
        for (ExtendedMutation mutEvent : mutations) {
            long gene = mutEvent.getEntrezGeneId();
            if (mapGeneCna.containsKey(gene)) {
                continue;
            }

            String cna = daoGeneticAlteration.getGeneticAlteration(
                    DaoGeneticProfile.getGeneticProfileByStableId(cnaProfileId).getGeneticProfileId(),
                    sample.getInternalId(), gene);

            mapGeneCna.put(gene, cna);
        }

        return mapGeneCna;
    }

    private Map<String, List> initMap() {

        Map<String, List> map = new HashMap<>();
        map.put("id", new ArrayList());
        map.put("caseIds", new ArrayList());
        map.put("key", new ArrayList());
        map.put("chr", new ArrayList());
        map.put("start", new ArrayList());
        map.put("end", new ArrayList());
        map.put("entrez", new ArrayList());
        map.put("gene", new ArrayList());
        map.put("protein-start", new ArrayList());
        map.put("protein-end", new ArrayList());
        map.put("aa", new ArrayList());
        map.put("aa-orig", new ArrayList());
        map.put("ref", new ArrayList());
        map.put("var", new ArrayList());
        map.put("type", new ArrayList());
        map.put("status", new ArrayList());
        map.put("cosmic", new ArrayList());
        map.put("mutsig", new ArrayList());
        map.put("genemutrate", new ArrayList());
        map.put("keymutrate", new ArrayList());
        map.put("cna", new ArrayList());
        map.put("mrna", new ArrayList());
        map.put("sanger", new ArrayList());
        map.put("cancer-gene", new ArrayList());
        map.put("drug", new ArrayList());
        map.put("ma", new ArrayList());
        map.put("alt-count", new ArrayList());
        map.put("ref-count", new ArrayList());
        map.put("normal-alt-count", new ArrayList());
        map.put("normal-ref-count", new ArrayList());
        map.put("validation", new ArrayList());
        map.put("mycancergenome", new ArrayList());
        map.put("is-hotspot", new ArrayList());

        return map;
    }

    private void exportMutation(Map<String, List> data, Map<Long, Integer> mapMutationEventIndex,
                                ExtendedMutation mutation, CancerStudy cancerStudy, Set<String> drugs,
                                int geneContext, int keywordContext, Set<CosmicMutationFrequency> cosmic,
                                Map<String, Object> mrna, String cna, List<String> mycancergenomelinks)
            throws DaoException, IOException {

        Sample sample = DaoSample.getSampleById(mutation.getSampleId());
        Long eventId = mutation.getMutationEventId();
        Integer ix = mapMutationEventIndex.get(eventId);
        if (ix != null) {
            ((List<String>) data.get("caseIds").get(ix)).add(DaoSample.getSampleById(
                    mutation.getSampleId()).getStableId());
            addReadCountMap(((Map<String, Integer>) data.get("alt-count").get(ix)), sample.getStableId(),
                    mutation.getTumorAltCount());
            addReadCountMap(((Map<String, Integer>) data.get("ref-count").get(ix)), sample.getStableId(),
                    mutation.getTumorRefCount());
            addReadCountMap(((Map<String, Integer>) data.get("normal-alt-count").get(ix)), sample.getStableId(),
                    mutation.getNormalAltCount());
            addReadCountMap(((Map<String, Integer>) data.get("normal-ref-count").get(ix)), sample.getStableId(),
                    mutation.getNormalRefCount());
            return;
        }

        mapMutationEventIndex.put(eventId, data.get("id").size());

        data.get("id").add(mutation.getMutationEventId());
        List<String> samples = new ArrayList<>();
        samples.add(sample.getStableId());
        data.get("caseIds").add(samples);
        data.get("key").add(mutation.getKeyword());
        data.get("chr").add(mutation.getChr());
        data.get("start").add(mutation.getStartPosition());
        data.get("end").add(mutation.getEndPosition());
        data.get("entrez").add(mutation.getEntrezGeneId());
        data.get("gene").add(mutation.getGeneSymbol());
        data.get("protein-start").add(mutation.getOncotatorProteinPosStart());
        data.get("protein-end").add(mutation.getOncotatorProteinPosEnd());
        data.get("aa").add(mutation.getProteinChange());
        data.get("aa-orig").add(mutation.getAminoAcidChange());
        data.get("ref").add(mutation.getReferenceAllele());
        data.get("var").add(mutation.getTumorSeqAllele());
        data.get("type").add(mutation.getMutationType());
        data.get("status").add(mutation.getMutationStatus());
        data.get("alt-count").add(addReadCountMap(new HashMap<String, Integer>(), sample.getStableId(),
                mutation.getTumorAltCount()));
        data.get("ref-count").add(addReadCountMap(new HashMap<String, Integer>(), sample.getStableId(),
                mutation.getTumorRefCount()));
        data.get("normal-alt-count").add(addReadCountMap(new HashMap<String, Integer>(), sample.getStableId(),
                mutation.getNormalAltCount()));
        data.get("normal-ref-count").add(addReadCountMap(new HashMap<String, Integer>(), sample.getStableId(),
                mutation.getNormalRefCount()));
        data.get("validation").add(mutation.getValidationStatus());
        data.get("cna").add(cna);
        data.get("mrna").add(mrna);
        data.get("mycancergenome").add(mycancergenomelinks);
        data.get("is-hotspot").add(OncokbHotspotUtil.getOncokbHotspot(mutation.getGeneSymbol(),
                mutation.getProteinChange()));
        data.get("cosmic").add(alterationUtil.convertCosmicDataToMatrix(cosmic));
        data.get("mutsig").add(mutSigUtil.getMutSig(cancerStudy.getInternalId()).get(mutation.getEntrezGeneId()));
        data.get("genemutrate").add(geneContext);
        data.get("keymutrate").add(keywordContext);
        data.get("sanger").add(DaoSangerCensus.getInstance().getCancerGeneSet().containsKey(mutation.getGeneSymbol()));
        data.get("cancer-gene").add(DaoGeneOptimized.getInstance().isCbioCancerGene(mutation.getGene()));
        data.get("drug").add(drugs);

        Map<String, String> ma = new HashMap<>();
        ma.put("score", mutation.getFunctionalImpactScore());
        ma.put("xvia", mutation.getLinkXVar());
        ma.put("pdb", mutation.getLinkPdb());
        ma.put("msa", mutation.getLinkMsa());
        data.get("ma").add(ma);
    }

    private Map<String, Integer> addReadCountMap(Map<String, Integer> map, String sampleId, int readCount) {
        if (readCount >= 0) {
            map.put(sampleId, readCount);
        }
        return map;
    }

    private Map<String, Integer> getGeneContextMap(List<ExtendedMutation> mutations, int profileId,
                                                   DaoGeneOptimized daoGeneOptimized) {

        List<Integer> genes = getGenesOfMutations(mutations);

        Map<Long, Integer> map = mutationModelConverter.convertMutatedGeneSampleCountToMap(
                mutationRepository.countSamplesWithMutatedGenes(profileId, genes));
        Map<String, Integer> ret = new HashMap<>(map.size());
        for (Map.Entry<Long, Integer> entry : map.entrySet()) {
            ret.put(daoGeneOptimized.getGene(entry.getKey())
                    .getHugoGeneSymbolAllCaps(), entry.getValue());
        }
        return ret;
    }

    private Map<String, Integer> getKeywordContextMap(List<ExtendedMutation> mutations, int profileId) {

        List<Integer> intEventIds = getMutationEventIds(mutations);
        Set<String> genes = new HashSet<>(mutationRepository.getKeywordsOfMutations(intEventIds));
        return mutationModelConverter.convertKeywordSampleCountToMap(
                mutationRepository.countSamplesWithKeywords(profileId, new ArrayList<>(genes)));
    }

    private List<Integer> getMutationEventIds(List<ExtendedMutation> mutations) {
        List<Integer> intEventIds = new ArrayList<>();
        for (ExtendedMutation extendedMutation : mutations) {
            intEventIds.add((int) extendedMutation.getMutationEventId());
        }
        return intEventIds;
    }
}