import React, { useState } from "react";
import "./Styles/MarkdownCard.css";

function MarkdownCard({ 
  title = "Information",
  defaultContent = "This is a customizable information card.\n\nYou can put instructions, notes, or system status here.",
  allowEditing = true 
}) {
  const [content, setContent] = useState(defaultContent);
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(content);

  const renderMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')       
      .replace(/\*(.*?)\*/g, '<em>$1</em>')                      
      .replace(/^\s*-\s+(.*$)/gm, '<li>$1</li>')                 
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')                
      .replace(/\n/g, '<br>')                                    
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  };

  const handleSave = () => {
    setContent(tempContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempContent(content);
    setIsEditing(false);
  };

  return (
    <div className="markdown-card-widget">
      <div className="widget-header">
        <h3>{title}</h3>
        {allowEditing && (
          <button 
            className="edit-btn"
            onClick={() => {
              if (isEditing) handleCancel();
              else setIsEditing(true);
            }}
          >
            {isEditing ? "Cancel" : "✏️ Edit"}
          </button>
        )}
      </div>

      <div className="card-content">
        {isEditing ? (
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            rows={12}
            placeholder="Write markdown here..."
          />
        ) : (
          <div 
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {isEditing && (
        <div className="edit-actions">
          <button className="btn secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

export default MarkdownCard;