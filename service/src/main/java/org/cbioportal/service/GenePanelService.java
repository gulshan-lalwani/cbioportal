/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package org.cbioportal.service;

/**
 *
 * @author heinsz
 */

import org.cbioportal.model.GenePanel;

public interface GenePanelService {
    
    GenePanel getGenePanelBySampleIdAndProfileId(Integer sampleId, Integer profileId);   
    
}
