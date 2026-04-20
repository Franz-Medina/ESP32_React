import React, { useState } from "react";
import "./Styles/WidgetStyle.css";

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
    <div className="widget">
      <div className="widget-title">{title}</div>

      <div className="widget-content">
        {isEditing ? (
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            placeholder="Write markdown here..."
            className="widget-textarea"
          />
        ) : (
          <div 
            className="widget-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {allowEditing && (
        <div className="widget-edit-area">
          {!isEditing ? (
            <button //Need to find an favicon to replace the pencil emoji
              className="widget-btn widget-btn-edit"
              onClick={() => setIsEditing(true)}
            >
              ✏️ Edit
            </button>
          ) : (
            <div className="widget-edit-actions">
              <button 
                className="widget-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                className="widget-btn widget-btn-primary"
                onClick={handleSave}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownCard;