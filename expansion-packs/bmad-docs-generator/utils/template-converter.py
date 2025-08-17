#!/usr/bin/env python3
"""
Template Converter for BMAD Core Architecture Templates

This module provides functionality to convert BMAD Core architecture templates
to doc-generator compatible formats.
"""

import yaml
import json
import re
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TemplateConverter:
    """
    Converts BMAD Core architecture templates to doc-generator format.
    """
    
    def __init__(self, source_dir: str = "bmad-core/templates"):
        """
        Initialize the template converter.
        
        Args:
            source_dir: Directory containing BMAD Core templates
        """
        self.source_dir = Path(source_dir)
        self.converted_templates = {}
        
    def convert_architecture_template(self, template_file: str) -> Dict[str, Any]:
        """
        Convert a BMAD Core architecture template to doc-generator format.
        
        Args:
            template_file: Path to the template file
            
        Returns:
            Converted template in doc-generator format
        """
        try:
            # Load the original template
            template_path = self.source_dir / template_file
            with open(template_path, 'r', encoding='utf-8') as f:
                original_template = yaml.safe_load(f)
            
            logger.info(f"Converting template: {template_file}")
            
            # Convert the template
            converted = self._convert_template_structure(original_template)
            
            # Store the converted template
            self.converted_templates[template_file] = converted
            
            return converted
            
        except Exception as e:
            logger.error(f"Error converting template {template_file}: {e}")
            raise
    
    def _convert_template_structure(self, original: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert the template structure from BMAD Core format to doc-generator format.
        
        Args:
            original: Original template structure
            
        Returns:
            Converted template structure
        """
        converted = {
            "template": self._convert_template_metadata(original.get("template", {})),
            "workflow": self._convert_workflow(original.get("workflow", {})),
            "sections": self._convert_sections(original.get("sections", [])),
            "validation_rules": self._extract_validation_rules(original),
            "quality_checks": self._extract_quality_checks(original)
        }
        
        return converted
    
    def _convert_template_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert template metadata.
        
        Args:
            metadata: Original metadata
            
        Returns:
            Converted metadata
        """
        return {
            "id": metadata.get("id", "converted-architecture-template"),
            "name": metadata.get("name", "Architecture Document"),
            "version": metadata.get("version", "1.0"),
            "source": metadata.get("id", "bmad-core-architecture-template"),
            "type": "architecture",
            "category": self._determine_category(metadata),
            "output": self._convert_output_config(metadata.get("output", {}))
        }
    
    def _convert_workflow(self, workflow: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert workflow configuration.
        
        Args:
            workflow: Original workflow configuration
            
        Returns:
            Converted workflow configuration
        """
        return {
            "mode": workflow.get("mode", "interactive"),
            "elicitation": workflow.get("elicitation", "advanced-elicitation"),
            "phases": self._convert_phases(workflow.get("phases", []))
        }
    
    def _convert_phases(self, phases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert workflow phases.
        
        Args:
            phases: Original phases
            
        Returns:
            Converted phases
        """
        converted_phases = []
        
        for phase in phases:
            converted_phase = {
                "name": phase.get("name", "unknown"),
                "description": phase.get("description", ""),
                "tasks": self._convert_tasks(phase.get("tasks", []))
            }
            converted_phases.append(converted_phase)
        
        return converted_phases
    
    def _convert_tasks(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert workflow tasks.
        
        Args:
            tasks: Original tasks
            
        Returns:
            Converted tasks
        """
        converted_tasks = []
        
        for task in tasks:
            converted_task = {
                "id": task.get("id", "unknown-task"),
                "name": task.get("name", "Unknown Task"),
                "description": task.get("description", ""),
                "agent": self._map_agent(task.get("agent", "doc-engineer")),
                "inputs": task.get("inputs", []),
                "outputs": task.get("outputs", [])
            }
            converted_tasks.append(converted_task)
        
        return converted_tasks
    
    def _convert_sections(self, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert template sections.
        
        Args:
            sections: Original sections
            
        Returns:
            Converted sections
        """
        converted_sections = []
        
        for section in sections:
            converted_section = {
                "id": section.get("id", "unknown-section"),
                "title": section.get("title", "Unknown Section"),
                "instruction": section.get("instruction", ""),
                "content": self._convert_content(section.get("content", [])),
                "sections": self._convert_sections(section.get("sections", [])),
                "type": section.get("type", "text"),
                "condition": section.get("condition", ""),
                "repeatable": section.get("repeatable", False),
                "template": section.get("template", ""),
                "examples": section.get("examples", [])
            }
            converted_sections.append(converted_section)
        
        return converted_sections
    
    def _convert_content(self, content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert section content.
        
        Args:
            content: Original content
            
        Returns:
            Converted content
        """
        converted_content = []
        
        for item in content:
            converted_item = {
                "id": item.get("id", "unknown-content"),
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "template": item.get("template", ""),
                "type": item.get("type", "text"),
                "columns": item.get("columns", []),
                "instruction": item.get("instruction", ""),
                "elicit": item.get("elicit", False),
                "repeatable": item.get("repeatable", False)
            }
            converted_content.append(converted_item)
        
        return converted_content
    
    def _convert_output_config(self, output: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert output configuration.
        
        Args:
            output: Original output configuration
            
        Returns:
            Converted output configuration
        """
        return {
            "format": output.get("format", "markdown"),
            "filename": output.get("filename", "docs/architecture.md"),
            "title": output.get("title", "Architecture Document")
        }
    
    def _determine_category(self, metadata: Dict[str, Any]) -> str:
        """
        Determine the template category based on metadata.
        
        Args:
            metadata: Template metadata
            
        Returns:
            Template category
        """
        template_id = metadata.get("id", "").lower()
        
        if "brownfield" in template_id:
            return "brownfield"
        elif "greenfield" in template_id:
            return "greenfield"
        elif "microservices" in template_id:
            return "microservices"
        elif "serverless" in template_id:
            return "serverless"
        else:
            return "general"
    
    def _map_agent(self, original_agent: str) -> str:
        """
        Map BMAD Core agents to doc-generator agents.
        
        Args:
            original_agent: Original agent name
            
        Returns:
            Mapped agent name
        """
        agent_mapping = {
            "architect": "architecture-analyst",
            "tech-architect": "tech-stack-expert",
            "pattern-expert": "pattern-recognition-expert",
            "doc-engineer": "doc-engineer",
            "code-analyst": "code-analyst",
            "flow-analyst": "flow-analyst",
            "problem-solver": "problem-solver"
        }
        
        return agent_mapping.get(original_agent, "doc-engineer")
    
    def _extract_validation_rules(self, template: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract validation rules from the template.
        
        Args:
            template: Original template
            
        Returns:
            Validation rules
        """
        validation_rules = {
            "required_fields": [],
            "field_validation": {},
            "cross_field_validation": []
        }
        
        # Extract required fields from sections
        sections = template.get("sections", [])
        for section in sections:
            if section.get("elicit", False):
                section_id = section.get("id", "")
                if section_id:
                    validation_rules["required_fields"].append(section_id)
        
        return validation_rules
    
    def _extract_quality_checks(self, template: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract quality checks from the template.
        
        Args:
            template: Original template
            
        Returns:
            Quality checks
        """
        quality_checks = []
        
        # Add standard quality checks
        quality_checks.extend([
            {
                "name": "completeness",
                "description": "Check if all required sections are completed",
                "type": "completeness"
            },
            {
                "name": "consistency",
                "description": "Check for consistency across sections",
                "type": "consistency"
            },
            {
                "name": "quality",
                "description": "Check overall document quality",
                "type": "quality"
            }
        ])
        
        return quality_checks
    
    def save_converted_template(self, template_file: str, output_dir: str = "templates/architecture-templates"):
        """
        Save the converted template to a file.
        
        Args:
            template_file: Original template file name
            output_dir: Output directory for converted templates
        """
        if template_file not in self.converted_templates:
            raise ValueError(f"Template {template_file} has not been converted")
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate output filename
        base_name = Path(template_file).stem
        output_filename = f"{base_name}-converted.yaml"
        output_file = output_path / output_filename
        
        # Save the converted template
        with open(output_file, 'w', encoding='utf-8') as f:
            yaml.dump(self.converted_templates[template_file], f, 
                     default_flow_style=False, allow_unicode=True, indent=2)
        
        logger.info(f"Saved converted template to: {output_file}")
    
    def convert_all_templates(self, output_dir: str = "templates/architecture-templates"):
        """
        Convert all architecture templates in the source directory.
        
        Args:
            output_dir: Output directory for converted templates
        """
        template_files = [
            "architecture-tmpl.yaml",
            "brownfield-architecture-tmpl.yaml",
            "front-end-architecture-tmpl.yaml",
            "fullstack-architecture-tmpl.yaml"
        ]
        
        for template_file in template_files:
            if (self.source_dir / template_file).exists():
                try:
                    self.convert_architecture_template(template_file)
                    self.save_converted_template(template_file, output_dir)
                except Exception as e:
                    logger.error(f"Failed to convert {template_file}: {e}")
            else:
                logger.warning(f"Template file not found: {template_file}")
    
    def generate_template_index(self, output_dir: str = "templates/architecture-templates"):
        """
        Generate an index of all converted templates.
        
        Args:
            output_dir: Output directory
        """
        index = {
            "templates": [],
            "categories": {},
            "metadata": {
                "total_templates": len(self.converted_templates),
                "conversion_date": str(Path().cwd()),
                "source": "bmad-core"
            }
        }
        
        for template_file, converted_template in self.converted_templates.items():
            template_info = {
                "original_file": template_file,
                "converted_file": f"{Path(template_file).stem}-converted.yaml",
                "id": converted_template["template"]["id"],
                "name": converted_template["template"]["name"],
                "category": converted_template["template"]["category"],
                "version": converted_template["template"]["version"]
            }
            
            index["templates"].append(template_info)
            
            # Group by category
            category = template_info["category"]
            if category not in index["categories"]:
                index["categories"][category] = []
            index["categories"][category].append(template_info)
        
        # Save the index
        output_path = Path(output_dir)
        index_file = output_path / "template-index.yaml"
        
        with open(index_file, 'w', encoding='utf-8') as f:
            yaml.dump(index, f, default_flow_style=False, allow_unicode=True, indent=2)
        
        logger.info(f"Generated template index: {index_file}")


def main():
    """
    Main function to run the template converter.
    """
    converter = TemplateConverter()
    
    # Convert all templates
    converter.convert_all_templates()
    
    # Generate template index
    converter.generate_template_index()
    
    logger.info("Template conversion completed successfully!")


if __name__ == "__main__":
    main()
